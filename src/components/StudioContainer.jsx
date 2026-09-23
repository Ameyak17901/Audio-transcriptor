/* eslint-disable react/prop-types */
import { useState } from "react";
import AudioRecorder from "./AudioRecorder";
import AudioDropzone from "./AudioDropzone";

const StudioContainer = ({ onTranscribed }) => {
  const [activeTab, setActiveTab] = useState("microphone"); // 'microphone' | 'upload'

  return (
    <div className="w-full flex flex-col items-center">
      {/* Segmented Mode Switcher */}
      <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-2xl mb-6 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("microphone")}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "microphone"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          aria-pressed={activeTab === "microphone"}
        >
          <svg
            className={`w-4 h-4 ${
              activeTab === "microphone" ? "text-sky-600" : "text-slate-400"
            }`}
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
          <span>Record with Mic</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "upload"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          aria-pressed={activeTab === "upload"}
        >
          <svg
            className={`w-4 h-4 ${
              activeTab === "upload" ? "text-sky-600" : "text-slate-400"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <span>Upload Audio File</span>
        </button>
      </div>

      {/* Active Studio View */}
      <div className="w-full">
        {activeTab === "microphone" ? (
          <AudioRecorder setData={onTranscribed} />
        ) : (
          <AudioDropzone onTranscribed={onTranscribed} />
        )}
      </div>
    </div>
  );
};

export default StudioContainer;
