import { useState } from "react";
import AudioRecorder from "./AudioRecorder";
import Transcription from "./Transcription";
import TranscribeHistory from "./TranscribeHistory";

const AppLayout = () => {
  const [data, setData] = useState([]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 flex flex-col items-center py-10 px-4 sm:px-6">
      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col items-center text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold mb-3">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          AI Speech-to-Text Studio
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Audio Transcription
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-md">
          Record your voice and instantly transcribe it with Deepgram AI.
        </p>
      </header>

      {/* Main Studio Area */}
      <main className="w-full max-w-4xl flex flex-col gap-8 items-center">
        {/* Recording Control Center */}
        <section className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <AudioRecorder setData={setData} />
        </section>

        {/* Transcriptions and History Content */}
        <section className="w-full flex flex-col md:flex-row gap-6 items-start justify-center">
          <div className="flex-1 w-full">
            <Transcription data={data} />
          </div>

          {data.length > 0 && (
            <aside className="w-full md:w-72 flex-shrink-0">
              <TranscribeHistory data={data} />
            </aside>
          )}
        </section>
      </main>
    </div>
  );
};

export default AppLayout;
