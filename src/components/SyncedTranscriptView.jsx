/* eslint-disable react/prop-types */
import { useState, useRef, useMemo } from "react";
import { formatDuration } from "../hooks/useAudioRecorder";

const SyncedTranscriptView = ({ data, audioUrl }) => {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  const words = useMemo(() => alternative?.words || [], [alternative]);
  const fallbackTranscript = alternative?.transcript || "";

  // Track playback time
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Click on word to seek audio to that exact moment
  const handleWordClick = (startSeconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startSeconds;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // Find active word index
  const activeWordIndex = useMemo(() => {
    if (!words || words.length === 0 || !isPlaying) return -1;
    // Add small buffer window for smooth perception
    return words.findIndex(
      (w) => currentTime >= w.start - 0.05 && currentTime <= w.end + 0.1
    );
  }, [words, currentTime, isPlaying]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Audio Player */}
      {audioUrl && (
        <div className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            className="w-full sm:flex-1 h-9 rounded-lg focus:outline-none"
          />
          <span className="text-xs text-slate-500 font-mono whitespace-nowrap px-2">
            Click any word to seek
          </span>
        </div>
      )}

      {/* Synchronized Word Stream */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-slate-800 text-sm sm:text-base leading-relaxed selection:bg-sky-100 max-h-[300px] overflow-y-auto">
        {words.length > 0 ? (
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-baseline">
            {words.map((item, idx) => {
              const isActive = idx === activeWordIndex;
              const displayWord = item.punctuated_word || item.word;

              return (
                <button
                  key={`${item.word}_${item.start}_${idx}`}
                  type="button"
                  onClick={() => handleWordClick(item.start)}
                  title={`Jump to ${formatDuration(Math.floor(item.start))}`}
                  className={`inline cursor-pointer rounded px-1 py-0.5 transition-all text-left font-normal ${
                    isActive
                      ? "bg-sky-500 text-white font-semibold shadow-sm scale-105"
                      : "hover:bg-sky-100 hover:text-sky-900 text-slate-800"
                  }`}
                >
                  {displayWord}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{fallbackTranscript || "No transcript available."}</p>
        )}
      </div>
    </div>
  );
};

export default SyncedTranscriptView;
