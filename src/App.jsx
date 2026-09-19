import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import TranscriptPage from "./pages/TranscriptPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />} />
        <Route
          path="/transcript"
          element={
            <div className="flex items-center min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
              <TranscriptPage />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
