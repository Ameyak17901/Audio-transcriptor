import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranscriptions } from "../hooks/useTranscriptions";
import { exportAsTxt, exportAsJson, exportAsSrt } from "../utils/exportHelpers";
import SyncedTranscriptView from "../components/SyncedTranscriptView";

const TranscriptPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateTranscript, deleteTranscript } = useTranscriptions();

  const initialItem = location?.state;
  const [item, setItem] = useState(initialItem);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const transcript =
    item?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "No transcript content found.";
  const [editText, setEditText] = useState(transcript);

  const confidence = item?.results?.channels?.[0]?.alternatives?.[0]?.confidence;
  const duration = item?.metadata?.duration;
  const created = item?.createdAt || item?.metadata?.created;
  const isEdited = item?.metadata?.user_edited;

  const exportMenuRef = useRef(null);

  useEffect(() => {
    setEditText(transcript);
  }, [transcript]);

  // Close export dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setIsExportOpen(false);
      }
    };
    if (isExportOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isExportOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  const handleSaveEdit = () => {
    if (item?.id) {
      updateTranscript(item.id, editText.trim());
      // Update local state copy
      setItem((prev) => {
        const channels = prev.results?.channels || [];
        const updatedChannels = channels.map((ch, idx) => {
          if (idx === 0) {
            const alts = ch.alternatives || [];
            const updatedAlts = alts.map((alt, altIdx) =>
              altIdx === 0 ? { ...alt, transcript: editText.trim() } : alt
            );
            return { ...ch, alternatives: updatedAlts };
          }
          return ch;
        });
        return {
          ...prev,
          results: { ...prev.results, channels: updatedChannels },
          metadata: { ...prev.metadata, user_edited: true },
        };
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this transcript?")) {
      if (item?.id) {
        deleteTranscript(item.id);
      }
      navigate("/");
    }
  };

  const formattedDate = created
    ? new Date(created).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown date";

  const filename = `transcript_${item?.id || "detail"}`;

  return (
    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Transcript Details</h2>
            {isEdited && (
              <span className="text-amber-600 bg-amber-50 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-semibold">
                Edited
              </span>
            )}
          </div>
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

      {/* Metadata Badges */}
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

      {/* Transcript Text / Edit Mode */}
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={7}
            className="w-full text-base text-slate-800 bg-slate-50 border border-sky-400 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-sky-200 transition"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditText(transcript);
                setIsEditing(false);
              }}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
            >
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        <SyncedTranscriptView
          data={item}
          audioUrl={item?.audioUrl || item?.audioPreviewUrl}
        />
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete Transcript</span>
        </button>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              Edit Text
            </button>
          )}

          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <span>Export</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExportOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    exportAsTxt(item, `${filename}.txt`);
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Plain Text</span>
                  <span className="text-[10px] text-slate-400 font-mono">.txt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportAsSrt(item, `${filename}.srt`);
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Subtitles</span>
                  <span className="text-[10px] text-slate-400 font-mono">.srt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportAsJson(item, `${filename}.json`);
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between border-t border-slate-100"
                >
                  <span>Full JSON Data</span>
                  <span className="text-[10px] text-slate-400 font-mono">.json</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm px-5 py-2 rounded-xl shadow transition"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
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
    </div>
  );
};

export default TranscriptPage;