/* eslint-disable react/prop-types */
import { useNavigate } from "react-router-dom";

const TranscribeHistoryItem = ({ data }) => {
  const navigate = useNavigate();
  const transcript =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "Empty transcript";
  const created = data?.metadata?.created;

  const formattedDate = created
    ? new Date(created).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent";

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex flex-col gap-1 border border-slate-200 rounded-xl p-3 hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer transition text-left"
      onClick={() => {
        navigate("/transcript", { state: data });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate("/transcript", { state: data });
        }
      }}
    >
      <p className="text-xs text-slate-700 font-medium line-clamp-2">
        {transcript}
      </p>
      <span className="text-[10px] text-slate-400 font-mono">
        {formattedDate}
      </span>
    </div>
  );
};

export default TranscribeHistoryItem;
