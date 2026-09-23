/* eslint-disable react/prop-types */
import { useState, useRef, useEffect, useCallback } from "react";
import { speechToText } from "../services/transcriptAPI";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".aac"];

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const AudioDropzone = ({ onTranscribed }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const activeUrlRef = useRef(null);

  const cleanupAudioUrl = useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
  }, []);

  const resetSelection = useCallback(() => {
    cleanupAudioUrl();
    setSelectedFile(null);
    setAudioUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [cleanupAudioUrl]);

  useEffect(() => {
    return () => {
      cleanupAudioUrl();
    };
  }, [cleanupAudioUrl]);

  const validateAndSelectFile = (file) => {
    setError(null);
    if (!file) return;

    // Check size limit (25MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File size (${formatFileSize(file.size)}) exceeds the 25MB maximum limit. Please upload a smaller audio clip.`
      );
      return;
    }

    // Check file type
    const hasValidMime = file.type && file.type.startsWith("audio/");
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const hasValidExtension = ACCEPTED_EXTENSIONS.includes(extension);

    if (!hasValidMime && !hasValidExtension) {
      setError("Please select a supported audio file (.mp3, .wav, .m4a, .ogg, .webm, .flac).");
      return;
    }

    cleanupAudioUrl();
    const url = URL.createObjectURL(file);
    activeUrlRef.current = url;
    setSelectedFile(file);
    setAudioUrl(url);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;
    setIsTranscribing(true);
    setError(null);

    try {
      const result = await speechToText(selectedFile);
      if (result) {
        if (onTranscribed) {
          onTranscribed(result);
        }
        resetSelection();
      }
    } catch (err) {
      setError(err.message || "Failed to transcribe audio file. Please check your API key and file.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-4 p-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Error Callout */}
      {error && (
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
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* State 1: Dropzone (No File Selected) */}
      {!selectedFile && (
        <div
          role="region"
          aria-label="Audio file drop target"
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            isDragging
              ? "border-sky-500 bg-sky-50/70 scale-[1.01]"
              : "border-slate-300 hover:border-sky-400 hover:bg-slate-50/80 bg-white"
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Click to upload or drag & drop audio here
          </p>
          <p className="text-xs text-slate-400 mt-1">
            MP3, WAV, M4A, OGG, WEBM, FLAC (Max 25MB)
          </p>
        </div>
      )}

      {/* State 2: File Selected & Previewing */}
      {selectedFile && (
        <div className="flex flex-col items-center gap-4 w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
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
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetSelection}
              disabled={isTranscribing}
              className="text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition"
              aria-label="Remove selected audio file"
            >
              Remove
            </button>
          </div>

          {/* Audio Player Preview */}
          {audioUrl && (
            <div className="w-full">
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 rounded-lg focus:outline-none"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full justify-end pt-1">
            <button
              type="button"
              disabled={isTranscribing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition text-sm font-medium focus:outline-none"
            >
              <span>Choose Another File</span>
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
                  <span>Transcribing Audio...</span>
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
                  <span>Transcribe File</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioDropzone;
