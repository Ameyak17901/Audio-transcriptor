/* eslint-disable react/prop-types */
import { useState } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { speechToText } from "../services/transcriptAPI";
import AudioVisualizer from "./AudioVisualizer";
import AudioDeviceSelector from "./AudioDeviceSelector";

const AudioRecorder = ({ setData, onTranscribed }) => {
  const {
    isRecording,
    isReviewing,
    formattedTime,
    audioBlob,
    audioUrl,
    mediaStream,
    error: recorderError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setApiError(null);

    try {
      const result = await speechToText(audioBlob);
      if (result) {
        if (typeof onTranscribed === "function") {
          onTranscribed(result);
        } else if (typeof setData === "function") {
          setData((prev) => (Array.isArray(prev) ? [result, ...prev] : result));
        }
        resetRecording();
      }
    } catch (err) {
      setApiError(err.message || "Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const activeError = recorderError || apiError;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-4 p-4">
      {/* Error Callout Banner */}
      {activeError && (
        <div
          role="alert"
          className="w-full flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl transition-all shadow-sm"
        >
          <svg
            className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">{activeError}</div>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="text-red-400 hover:text-red-600 transition"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* State 1: Idle (Initial State) */}
      {!isRecording && !isReviewing && (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => startRecording(selectedDeviceId)}
            className="group flex items-center gap-3 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-medium px-6 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-sky-200"
            aria-label="Start audio recording"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-white group-hover:scale-110 transition-transform" />
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span>Start Recording</span>
          </button>

          <span className="text-xs text-slate-500">
            Click to record with your microphone
          </span>

          {/* Microphone Selector */}
          <AudioDeviceSelector
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={setSelectedDeviceId}
            disabled={isRecording}
          />
        </div>
      )}

      {/* State 2: Active Recording */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 w-full bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
          <div className="flex items-center gap-3" aria-live="polite">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-red-400">
              Recording Live
            </span>
            <span className="font-mono text-2xl font-bold tracking-widest ml-2">
              {formattedTime}
            </span>
          </div>

          {/* Live Waveform Canvas Visualizer */}
          <AudioVisualizer mediaStream={mediaStream} className="w-full my-1" />

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-medium px-6 py-2.5 rounded-full shadow transition-all focus:outline-none focus:ring-4 focus:ring-red-300"
            aria-label="Stop recording"
          >
            <span className="w-3 h-3 bg-white rounded-sm" />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {/* State 3: Review & Transcribe */}
      {isReviewing && (
        <div className="flex flex-col items-center gap-4 w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Preview Recorded Audio</span>
              <span className="font-mono font-medium">{formattedTime}</span>
            </div>
            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 rounded-lg focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center gap-3 w-full justify-end pt-1">
            <button
              type="button"
              disabled={isTranscribing}
              onClick={resetRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition text-sm font-medium focus:outline-none"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Re-record</span>
            </button>

            <button
              type="button"
              disabled={isTranscribing}
              onClick={handleTranscribe}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 active:scale-95 text-white text-sm font-semibold px-5 py-2 rounded-lg shadow transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
            >
              {isTranscribing ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Transcribing...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Transcribe Audio</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
