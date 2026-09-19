import TranscribeHistoryItem from "./TranscibeHistoryItem";

/*eslint-disable react/prop-types*/
const TranscribeHistory = ({ data = [] }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full max-w-xs flex flex-col bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-[520px] overflow-hidden">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 mb-2">
        Recent History
      </h3>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scroll-smooth">
        {data.map((item, i) => (
          <TranscribeHistoryItem
            key={item?.metadata?.request_id || item?.metadata?.created || i}
            data={item}
          />
        ))}
      </div>
    </div>
  );
};

export default TranscribeHistory;
