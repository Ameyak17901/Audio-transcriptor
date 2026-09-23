/* eslint-disable react/prop-types */
import { useNavigate } from "react-router-dom";

const TranscribeHistoryItem = ({ data, onDelete }) => {
  const navigate = useNavigate();
  const transcript =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "Empty transcript";
  const created = data?.createdAt || data?.metadata?.created;
  const isEdited = data?.metadata?.user_edited;

  const formattedDate = created
    ? new Date(created).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent";

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete && data?.id) {
      onDelete(data.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex flex-col gap-1 border border-slate-200 rounded-xl p-3 hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer transition text-left bg-white"
      onClick={() => {
        navigate("/transcript", { state: data });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate("/transcript", { state: data });
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-700 font-medium line-clamp-2 flex-1">
          {transcript}
        </p>

        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete transcript"
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition p-1 -mr-1 -mt-1 rounded hover:bg-red-50"
            aria-label="Delete transcript"
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
        <span>{formattedDate}</span>
        {isEdited && (
          <span className="text-amber-600 font-sans font-medium">Edited</span>
        )}
      </div>
    </div>
  );
};

export default TranscribeHistoryItem;
