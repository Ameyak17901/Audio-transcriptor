import { useState } from "react";
import { useTranscriptions } from "../hooks/useTranscriptions";
import { useAuth } from "../context/AuthContext";
import StudioContainer from "./StudioContainer";
import Transcription from "./Transcription";
import TranscribeHistory from "./TranscribeHistory";
import AuthModal from "./AuthModal";

const AppLayout = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();

  const {
    filteredTranscripts,
    searchQuery,
    setSearchQuery,
    addTranscript,
    updateTranscript,
    deleteTranscript,
    clearAllTranscripts,
    totalCount,
    isSyncing,
  } = useTranscriptions();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 flex flex-col items-center py-10 px-4 sm:px-6">
      {/* Top Navbar / Auth Banner */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          AI Speech-to-Text Studio
        </div>

        <div className="flex items-center gap-3">
          {isSyncing && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5 animate-pulse font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Syncing...
            </span>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Cloud Database Synced" />
              <span className="text-slate-700 font-medium max-w-[150px] truncate">
                {user?.email || "Authenticated User"}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="text-slate-400 hover:text-red-600 transition pl-1 border-l border-slate-200 font-semibold"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-sky-300 hover:text-sky-600 px-3.5 py-1.5 rounded-full shadow-sm text-xs font-semibold text-slate-700 transition"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Sign In to Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col items-center text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Audio Transcription
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-md">
          Record your voice or upload audio files to transcribe with Deepgram AI and save directly to Supabase Cloud.
        </p>
      </header>

      {/* Main Studio Area */}
      <main className="w-full max-w-4xl flex flex-col gap-8 items-center">
        {/* Studio Recording & Dropzone Switcher */}
        <section className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <StudioContainer onTranscribed={addTranscript} />
        </section>

        {/* Transcriptions and History Content */}
        <section className="w-full flex flex-col md:flex-row gap-6 items-start justify-center">
          <div className="flex-1 w-full">
            <Transcription
              data={filteredTranscripts}
              onUpdate={updateTranscript}
              onDelete={deleteTranscript}
            />
          </div>

          <aside className="w-full md:w-80 flex-shrink-0">
            <TranscribeHistory
              data={filteredTranscripts}
              totalCount={totalCount}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onDelete={deleteTranscript}
              onClearAll={clearAllTranscripts}
            />
          </aside>
        </section>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};

export default AppLayout;
