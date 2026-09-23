/* eslint-disable react/prop-types */
import TranscribeHistoryItem from "./TranscibeHistoryItem";

const TranscribeHistory = ({
  data = [],
  totalCount = 0,
  searchQuery = "",
  setSearchQuery,
  onDelete,
  onClearAll,
}) => {
  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all transcription history?")) {
      if (onClearAll) onClearAll();
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-[540px] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            History
          </h3>
          <span className="text-[11px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full font-semibold">
            {searchQuery ? `${data.length}/${totalCount}` : totalCount}
          </span>
        </div>

        {totalCount > 0 && onClearAll && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-red-500 hover:text-red-700 font-medium transition px-1.5 py-0.5 rounded hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
          placeholder="Search transcripts..."
          className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery && setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
            aria-label="Clear search query"
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable History Stream */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scroll-smooth">
        {data.length > 0 ? (
          data.map((item, i) => (
            <TranscribeHistoryItem
              key={item?.id || item?.metadata?.request_id || i}
              data={item}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            {searchQuery ? (
              <>
                <p className="text-xs font-medium text-slate-600">No matching items</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery && setSearchQuery("")}
                  className="text-xs text-sky-600 hover:underline mt-1"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p className="text-xs">No history recorded yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscribeHistory;
