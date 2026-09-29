import { useState, useCallback, useRef, useEffect } from "react";
import { startTranscriptionJob, subscribeToJobSSE } from "../services/sseJobService";
import { uploadAudioToSupabase } from "../services/supabaseUpload";

/**
 * React hook to manage async transcription jobs with live Server-Sent Events (SSE) updates.
 * Provides reactive progress, stage, message, and completion state.
 */
export function useTranscriptionJob() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | queued | processing | completed | failed
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const unsubscribeRef = useRef(null);

  const cancelJob = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setStatus("idle");
    setMessage("Job monitoring cancelled by user.");
  }, []);

  const runJob = useCallback(async (audioSource, options = {}) => {
    // Reset previous run state
    setError(null);
    setResult(null);
    setProgress(0);
    setStage("initializing");

    let targetPath = null;
    let targetUrl = null;

    try {
      // 1. Direct audio blob upload
      if (audioSource instanceof Blob) {
        setStatus("uploading");
        setStage("uploading");
        setMessage("Streaming audio directly to Supabase Storage");

        const uploadRes = await uploadAudioToSupabase(audioSource, null, (pct) => {
          setProgress(Math.round(pct * 0.2)); // 0-20%
          setMessage(`Uploading to storage (${pct}%)`);
        });
        targetPath = uploadRes.file_path;
      } else if (typeof audioSource === "string") {
        if (audioSource.startsWith("http://") || audioSource.startsWith("https://")) {
          targetUrl = audioSource;
        } else {
          targetPath = audioSource;
        }
      }

      setStatus("queued");
      setStage("enqueuing");
      setMessage("Enqueuing background transcription job");

      const jobData = await startTranscriptionJob({
        filePath: targetPath,
        audioUrl: targetUrl,
        ...options,
      });

      setJobId(jobData.job_id);
      setStatus("processing");

      return new Promise((resolve, reject) => {
        unsubscribeRef.current = subscribeToJobSSE(jobData.job_id, {
          onProgress: (evt) => {
            setProgress(evt.progress);
            setStage(evt.stage);
            setMessage(evt.message);
            setStatus("processing");
          },
          onComplete: (data) => {
            setProgress(100);
            setStatus("completed");
            setStage("completed");
            setMessage("Transcription completed successfully!");
            setResult(data);
            resolve(data);
          },
          onError: (err) => {
            setStatus("failed");
            setStage("failed");
            setError(err.message);
            setMessage(`Transcription failed: ${err.message}`);
            reject(err);
          },
        });
      });
    } catch (err) {
      setStatus("failed");
      setStage("failed");
      setError(err.message);
      setMessage(`Job initiation failed: ${err.message}`);
      throw err;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    jobId,
    status,
    progress,
    stage,
    message,
    result,
    error,
    isRunning: status === "uploading" || status === "queued" || status === "processing",
    runJob,
    cancelJob,
  };
}
