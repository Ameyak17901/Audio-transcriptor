import { uploadAudioToSupabase } from "./supabaseUpload";

/**
 * Transcribes audio blob via the backend proxy (/api/transcribe).
 * Zero API keys are exposed to the client browser.
 *
 * Supports both:
 * 1. Direct binary streaming (for quick recordings under 25MB).
 * 2. Direct Supabase Storage upload (bypasses server RAM, supports large recordings).
 *
 * @param {Blob} audioBlob - Recorded or uploaded audio blob
 * @param {Object} [options] - Transcription options
 * @param {string} [options.model="nova-3"] - Deepgram speech model
 * @param {boolean} [options.smartFormat=true] - Smart formatting
 * @param {boolean} [options.punctuate=true] - Punctuation
 * @param {string|null} [options.language=null] - Language code
 * @param {boolean} [options.useStorage=false] - Whether to route through Supabase direct upload
 * @param {(percent: number) => void} [options.onProgress] - Upload progress callback
 * @returns {Promise<Object>} - Deepgram transcription data
 */
export async function speechToText(audioBlob, options = {}) {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("Invalid audio data provided for transcription.");
  }

  // Guard against 0-byte or truncated recordings
  if (audioBlob.size < 500) {
    throw new Error(
      "The audio recording is too short or empty. Please record at least 1-2 seconds of speech."
    );
  }

  const {
    model = "nova-3",
    smartFormat = true,
    punctuate = true,
    language = null,
    useStorage = false,
    onProgress = null,
  } = options;

  // Route through Supabase Storage if requested
  if (useStorage) {
    try {
      const uploadResult = await uploadAudioToSupabase(audioBlob, null, onProgress);
      const result = await transcribeFromStorage(uploadResult.file_path, {
        model,
        smartFormat,
        punctuate,
        language,
      });
      return {
        ...result,
        storage_file_path: uploadResult.file_path,
        storage_bucket: uploadResult.bucket,
      };
    } catch (storageErr) {
      console.warn("Supabase direct upload failed or unconfigured, falling back to direct stream:", storageErr);
      // Fallback to direct binary stream
    }
  }

  const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const params = new URLSearchParams({
    model,
    smart_format: String(smartFormat),
    punctuate: String(punctuate),
  });
  if (language) {
    params.set("language", language);
  }

  const apiUrl = `${baseUrl}/api/transcribe?${params.toString()}`;
  const contentType = audioBlob.type || "audio/webm";

  const fetchOptions = {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: audioBlob,
  };

  let response;
  try {
    response = await fetch(apiUrl, fetchOptions);
  } catch (networkErr) {
    throw new Error(
      `Cannot connect to backend server: ${networkErr.message}. Ensure the backend is running.`
    );
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail =
        errorJson.detail ||
        errorJson.err_msg ||
        errorJson.message ||
        JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(
      `Transcription Error (${response.status}): ${errorDetail || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Transcribes audio already residing in Supabase Storage using zero-RAM URL proxying.
 *
 * @param {string} filePath - Path in the Supabase bucket
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function transcribeFromStorage(filePath, options = {}) {
  const {
    model = "nova-3",
    smartFormat = true,
    punctuate = true,
    language = null,
  } = options;

  const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const params = new URLSearchParams({
    model,
    smart_format: String(smartFormat),
    punctuate: String(punctuate),
  });
  if (language) {
    params.set("language", language);
  }

  const apiUrl = `${baseUrl}/api/transcribe?${params.toString()}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ file_path: filePath }),
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(
      `Storage Transcription Error (${response.status}): ${errorDetail || response.statusText}`
    );
  }

  return response.json();
}
