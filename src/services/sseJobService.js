import { uploadAudioToSupabase } from "./supabaseUpload";

const getBaseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/**
 * Dispatches an asynchronous transcription job to the backend.
 * Returns HTTP 202 Accepted metadata including the job_id and SSE stream_url.
 *
 * @param {Object} options
 * @param {string} [options.filePath] - Supabase Storage path
 * @param {string} [options.audioUrl] - Remote audio URL
 * @param {string} [options.model="nova-3"] - Deepgram ASR model
 * @param {boolean} [options.smartFormat=true] - Smart formatting
 * @param {boolean} [options.punctuate=true] - Punctuation
 * @param {string|null} [options.language=null] - Optional language code
 * @returns {Promise<{job_id: string, status: string, stream_url: string, poll_url: string}>}
 */
export async function startTranscriptionJob(options = {}) {
  const {
    filePath,
    audioUrl,
    model = "nova-3",
    smartFormat = true,
    punctuate = true,
    language = null,
  } = options;

  if (!filePath && !audioUrl) {
    throw new Error("Either 'filePath' or 'audioUrl' must be provided to start a transcription job.");
  }

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/jobs/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      file_path: filePath,
      audio_url: audioUrl,
      model,
      smart_format: smartFormat,
      punctuate,
      language,
    }),
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Failed to enqueue transcription job (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

/**
 * Polls the current status of an async transcription job (HTTP GET fallback).
 *
 * @param {string} jobId
 * @returns {Promise<Object>}
 */
export async function getJobStatus(jobId) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/jobs/${jobId}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to retrieve job status for '${jobId}': ${response.statusText}`);
  }

  return response.json();
}

/**
 * Subscribes to real-time progress events for a transcription job using Server-Sent Events (SSE).
 *
 * @param {string} jobId - The target job ID
 * @param {Object} callbacks
 * @param {(event: Object) => void} [callbacks.onProgress] - Called when a progress frame arrives
 * @param {(result: Object) => void} [callbacks.onComplete] - Called when the job successfully completes
 * @param {(error: Error) => void} [callbacks.onError] - Called when an error occurs
 * @returns {() => void} Unsubscribe function to cleanly close the SSE connection
 */
export function subscribeToJobSSE(jobId, callbacks = {}) {
  const { onProgress, onComplete, onError } = callbacks;
  const baseUrl = getBaseUrl();
  const streamUrl = `${baseUrl}/api/jobs/${jobId}/stream`;

  const eventSource = new EventSource(streamUrl);

  const cleanup = () => {
    eventSource.close();
  };

  // 1. Progress updates (10% -> 30% -> 60% -> 85%)
  eventSource.addEventListener("progress", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onProgress) onProgress(data);
    } catch (parseErr) {
      console.warn("Failed to parse SSE progress frame:", parseErr);
    }
  });

  // 2. Terminal Completion Event
  eventSource.addEventListener("complete", (event) => {
    try {
      const data = JSON.parse(event.data);
      cleanup();
      if (onComplete) onComplete(data.result || data);
    } catch (parseErr) {
      cleanup();
      if (onError) onError(new Error("Failed to parse completion payload from SSE"));
    }
  });

  // 3. Terminal Error Event
  eventSource.addEventListener("error", (event) => {
    try {
      if (event.data) {
        const data = JSON.parse(event.data);
        cleanup();
        if (onError) onError(new Error(data.error || "Async transcription job encountered an error"));
        return;
      }
    } catch {
      // Standard EventSource network disconnect/reconnect error
    }

    if (eventSource.readyState === EventSource.CLOSED) {
      cleanup();
      if (onError) onError(new Error("SSE connection closed by server"));
    }
  });

  return cleanup;
}

/**
 * High-level end-to-end asynchronous transcription with real-time SSE progress.
 *
 * Handles:
 * 1. Direct upload to Supabase Storage (if audioBlob is provided)
 * 2. Enqueues background transcription job on FastAPI
 * 3. Streams Server-Sent Events (SSE) updates to `onProgress`
 * 4. Resolves with full Deepgram transcription output
 *
 * @param {Blob|string} audioSource - Blob or Supabase storage path
 * @param {Object} [options]
 * @param {(event: {progress: number, stage: string, message: string}) => void} [options.onProgress]
 * @returns {Promise<Object>} Deepgram transcription result
 */
export async function transcribeAudioWithSSE(audioSource, options = {}) {
  const { onProgress, ...restOptions } = options;
  let targetPath = null;
  let targetUrl = null;

  // Handle direct audio blob upload
  if (audioSource instanceof Blob) {
    if (onProgress) {
      onProgress({ progress: 5, stage: "uploading", message: "Uploading audio directly to Supabase Storage" });
    }
    const uploadRes = await uploadAudioToSupabase(audioSource, null, (uploadPercent) => {
      if (onProgress) {
        // Map upload phase to 0-20% overall progress
        onProgress({
          progress: Math.round(uploadPercent * 0.2),
          stage: "uploading",
          message: `Uploading audio to cloud storage (${uploadPercent}%)`,
        });
      }
    });
    targetPath = uploadRes.file_path;
  } else if (typeof audioSource === "string") {
    if (audioSource.startsWith("http://") || audioSource.startsWith("https://")) {
      targetUrl = audioSource;
    } else {
      targetPath = audioSource;
    }
  } else {
    throw new Error("Invalid audioSource provided: expected Blob or URL/storage path string.");
  }

  // Enqueue background job
  const job = await startTranscriptionJob({
    filePath: targetPath,
    audioUrl: targetUrl,
    ...restOptions,
  });

  // Stream progress via SSE
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToJobSSE(job.job_id, {
      onProgress: (event) => {
        if (onProgress) {
          onProgress({
            progress: event.progress,
            stage: event.stage,
            message: event.message,
          });
        }
      },
      onComplete: (result) => {
        resolve(result);
      },
      onError: (err) => {
        reject(err);
      },
    });
  });
}
