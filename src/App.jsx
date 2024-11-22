import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import TranscriptPage from "./pages/TranscriptPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout></AppLayout>} />
        <Route
          path="/transcript"
          element={
            <div className="flex items-center h-screen w-screen justify-center bg-slate-300">
              <TranscriptPage />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
