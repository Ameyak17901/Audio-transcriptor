/* eslint-disable react/prop-types */
import { useState, useRef, useEffect } from "react";
import { exportAsTxt, exportAsJson, exportAsSrt } from "../utils/exportHelpers";

const TranscriptionItem = ({ data, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const transcriptText =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  const [editText, setEditText] = useState(transcriptText);

  const confidence =
    data?.results?.channels?.[0]?.alternatives?.[0]?.confidence;
  const duration = data?.metadata?.duration;
  const created = data?.createdAt || data?.metadata?.created;
  const isEdited = data?.metadata?.user_edited;

  const exportMenuRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync edit text when data updates
  useEffect(() => {
    setEditText(transcriptText);
  }, [transcriptText]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

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

  const handleSaveEdit = () => {
    if (onUpdate && data?.id) {
      onUpdate(data.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(transcriptText);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    if (onDelete && data?.id) {
      onDelete(data.id);
    }
  };

  const formattedDate = created
    ? new Date(created).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  const itemFilename = `transcript_${data?.id || "recording"}`;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 group relative">
      {/* Top Metadata & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
        <div className="flex items-center gap-2.5">
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
          {isEdited && (
            <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
              Edited
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Edit Toggle */}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition text-slate-600 hover:text-sky-600 hover:bg-sky-50"
              title="Edit transcript"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Edit</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy transcript text to clipboard"
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition text-slate-600 hover:text-sky-600 hover:bg-sky-50"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition text-slate-600 hover:text-sky-600 hover:bg-sky-50"
              aria-expanded={isExportOpen}
              aria-haspopup="true"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
              <svg className="w-3 h-3 ml-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    exportAsTxt(data, `${itemFilename}.txt`);
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
                    exportAsSrt(data, `${itemFilename}.srt`);
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
                    exportAsJson(data, `${itemFilename}.json`);
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

          {/* Delete Button */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              title="Delete transcript"
              className="text-slate-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50"
              aria-label="Delete transcript"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content Area: Static vs. Inline Editing */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="w-full text-sm text-slate-800 bg-slate-50 border border-sky-400 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200 transition"
            placeholder="Edit your transcript..."
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded">Ctrl+Enter</kbd> to save
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-md shadow-sm transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap selection:bg-sky-100">
          {transcriptText || <span className="italic text-slate-400">Empty transcript</span>}
        </p>
      )}
    </div>
  );
};

export default TranscriptionItem;
