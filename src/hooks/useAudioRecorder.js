import { useState, useRef, useEffect, useCallback } from "react";

// Helper to determine the best supported MIME type across modern browsers
export const getSupportedMimeType = () => {
  if (typeof window === "undefined" || !window.MediaRecorder) return "";
  const candidateTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];
  return candidateTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

// Formats duration in seconds to MM:SS
export const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const useAudioRecorder = () => {
  // Status: 'idle' | 'recording' | 'reviewing'
  const [status, setStatus] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [error, setError] = useState(null);

  // Mutable refs to prevent React closure traps & track audio pipeline
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const activeUrlRef = useRef(null);

  // Teardown hardware microphone tracks
  const stopMicrophoneTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Failed to stop track:", e);
        }
      });
      streamRef.current = null;
    }
    setMediaStream(null);
  }, []);

  // Cleanup object URL to prevent memory leaks
  const cleanupAudioUrl = useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Reset all state to start over
  const resetRecording = useCallback(() => {
    clearTimer();
    stopMicrophoneTracks();
    cleanupAudioUrl();

    chunksRef.current = [];
    mediaRecorderRef.current = null;

    setStatus("idle");
    setRecordingSeconds(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setMediaStream(null);
    setError(null);
  }, [clearTimer, stopMicrophoneTracks, cleanupAudioUrl]);

  // Start recording
  const startRecording = useCallback(
    async (deviceId) => {
      setError(null);
      cleanupAudioUrl();
      chunksRef.current = [];
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingSeconds(0);

      if (!navigator?.mediaDevices?.getUserMedia) {
        setError("Audio recording is not supported in this browser environment.");
        return;
      }

      try {
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        if (deviceId) {
          audioConstraints.deviceId = { exact: deviceId };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        streamRef.current = stream;
        setMediaStream(stream);

        const mimeType = getSupportedMimeType();
        const options = mimeType ? { mimeType } : undefined;
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const resolvedMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
          const recordedBlob = new Blob(chunksRef.current, { type: resolvedMimeType });
          const objectUrl = URL.createObjectURL(recordedBlob);

          activeUrlRef.current = objectUrl;
          setAudioBlob(recordedBlob);
          setAudioUrl(objectUrl);
          setStatus("reviewing");

          // Immediately release microphone hardware
          stopMicrophoneTracks();
        };

        mediaRecorder.start(250); // Emit slices every 250ms for smooth chunk collection
        setStatus("recording");

        // Start elapsed timer
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        stopMicrophoneTracks();
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError(
            "Microphone permission was denied. Please allow microphone access to record audio."
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No microphone was detected on your system.");
        } else {
          setError(err.message || "Failed to access microphone.");
        }
        setStatus("idle");
      }
    },
    [cleanupAudioUrl, stopMicrophoneTracks]
  );

  // Stop recording
  const stopRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Error stopping MediaRecorder:", err);
      }
    }
  }, [clearTimer]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      clearTimer();
      stopMicrophoneTracks();
      cleanupAudioUrl();
    };
  }, [clearTimer, stopMicrophoneTracks, cleanupAudioUrl]);

  return {
    status,
    isRecording: status === "recording",
    isReviewing: status === "reviewing",
    recordingSeconds,
    formattedTime: formatDuration(recordingSeconds),
    audioBlob,
    audioUrl,
    mediaStream,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
};