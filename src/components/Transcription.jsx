/* eslint-disable react/prop-types */
import TranscriptionItem from "./TranscriptionItem";

const Transcription = ({ data }) => {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-[520px] bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-sky-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Transcripts ({data?.length || 0})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scroll-smooth">
        {data && data.length > 0 ? (
          data.map((item, i) => (
            <TranscriptionItem
              data={item}
              key={item.metadata?.request_id || item.metadata?.created || i}
            />
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">No transcripts yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Record audio using the microphone above, then click Transcribe to see your text here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transcription;
