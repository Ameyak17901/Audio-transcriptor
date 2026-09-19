import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TranscriptPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const item = location?.state;
  const [copied, setCopied] = useState(false);

  const transcript =
    item?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "No transcript content found.";
  const confidence = item?.results?.channels?.[0]?.alternatives?.[0]?.confidence;
  const duration = item?.metadata?.duration;
  const created = item?.metadata?.created;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  const formattedDate = created
    ? new Date(created).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown date";

  return (
    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Transcript Details</h2>
          <span className="text-xs text-slate-400 font-mono">{formattedDate}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-lg transition font-medium"
        >
          ← Back to Studio
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {duration && (
          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono">
            Duration: {duration.toFixed(2)}s
          </span>
        )}
        {confidence && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-medium">
            Confidence: {(confidence * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-800 text-base leading-relaxed whitespace-pre-wrap selection:bg-sky-100 min-h-[140px]">
        {transcript}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow transition"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy Text</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TranscriptPage;