/* eslint-disable react/prop-types */
import { useRef } from "react";
import { useAudioVisualizer } from "../hooks/useAudioVisualizer";

const AudioVisualizer = ({ mediaStream, className = "" }) => {
  const canvasRef = useRef(null);

  useAudioVisualizer(mediaStream, canvasRef);

  return (
    <div className={`w-full flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-12 rounded-xl bg-slate-950/40 backdrop-blur-sm border border-slate-800"
        style={{ width: "100%", height: "48px" }}
      />
    </div>
  );
};

export default AudioVisualizer;
