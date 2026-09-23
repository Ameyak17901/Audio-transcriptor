import { useEffect, useRef } from "react";

/**
 * Custom hook to render a 60fps frequency bar visualizer on an HTML5 canvas
 * using Web Audio API (AudioContext + AnalyserNode).
 *
 * Runs strictly imperatively outside React state to avoid 60fps re-render overhead.
 */
export const useAudioVisualizer = (mediaStream, canvasRef) => {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!mediaStream || !canvas) {
      // Clear canvas if stream is not active
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let isMounted = true;

    // 1. Initialize AudioContext & AnalyserNode
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    audioContextRef.current = audioCtx;

    // Ensure audio context is running (mitigate browser autoplay suspension)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch((err) => console.warn("Failed to resume AudioContext:", err));
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; // 32 frequency bins, clean for visualizer bars
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    try {
      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      sourceRef.current = source;
    } catch (err) {
      console.error("Failed to connect MediaStreamSource to AnalyserNode:", err);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const ctx = canvas.getContext("2d");

    // 2. High-DPI Retina Canvas Scaling
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();

    // 3. Render 60fps Animation Loop
    const render = () => {
      if (!isMounted) return;

      analyser.getByteFrequencyData(dataArray);

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Bar sizing & layout
      const barCount = 24; // Use top 24 active voice frequencies
      const gap = 3;
      const totalGaps = (barCount - 1) * gap;
      const barWidth = Math.max(3, (width - totalGaps) / barCount);

      // Create vertical color gradient (sky-400 to indigo-500)
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "#38bdf8"); // sky-400
      gradient.addColorStop(1, "#6366f1"); // indigo-500

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        // Sample frequency data with slight offset for vocal range
        const value = dataArray[i + 1] || 0;
        const percent = value / 255;
        // Minimum bar height of 4px so it looks lively even during silence
        const minHeight = 4;
        const barHeight = Math.max(minHeight, percent * (height - 8));

        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2; // Vertically center bars

        // Draw pill-shaped rounded bars
        const radius = Math.min(barWidth / 2, barHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    // 4. Teardown & Resource Cleanup
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore disconnect errors
        }
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
        audioContextRef.current = null;
      }
    };
  }, [mediaStream, canvasRef]);
};
