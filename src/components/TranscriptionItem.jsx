/* eslint-disable react/prop-types */
import { useState } from "react";

const TranscriptionItem = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const transcriptText =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  const confidence =
    data?.results?.channels?.[0]?.alternatives?.[0]?.confidence;
  const duration = data?.metadata?.duration;
  const created = data?.metadata?.created;

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  const formattedDate = created
    ? new Date(created).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 group">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          {formattedDate && <span>Recorded at {formattedDate}</span>}
          {duration && (
            <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">
              {duration.toFixed(1)}s
            </span>
          )}
          {confidence && (
            <span className="text-emerald-600 font-medium">
              {(confidence * 100).toFixed(0)}% accuracy
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy transcript text to clipboard"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition text-slate-600 hover:text-sky-600 hover:bg-sky-50"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-600">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap selection:bg-sky-100">
        {transcriptText || <span className="italic text-slate-400">Empty transcript</span>}
      </p>
    </div>
  );
};

export default TranscriptionItem;
