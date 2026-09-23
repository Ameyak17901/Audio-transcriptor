import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-cleanup DOM and mocks between tests
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// Mock URL methods
globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-audio-url");
globalThis.URL.revokeObjectURL = vi.fn();

// Mock Canvas 2D context
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
}));

// Mock AudioContext & AnalyserNode
class MockAudioContext {
  constructor() {
    this.state = "running";
  }
  createAnalyser() {
    return {
      fftSize: 64,
      frequencyBinCount: 32,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn((arr) => arr.fill(128)),
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

globalThis.AudioContext = MockAudioContext;
globalThis.webkitAudioContext = MockAudioContext;

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.options = options;
    this.state = "inactive";
    this.ondataavailable = null;
    this.onstop = null;
    this.mimeType = options.mimeType || "audio/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(["mock-audio-content"], { type: this.mimeType }),
      });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
}

MockMediaRecorder.isTypeSupported = vi.fn((type) => type.includes("webm") || type.includes("wav"));
globalThis.MediaRecorder = MockMediaRecorder;

// Mock navigator.mediaDevices
Object.defineProperty(navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          stop: vi.fn(),
          kind: "audio",
          label: "Mock Microphone Track",
        },
      ],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      { deviceId: "default", kind: "audioinput", label: "Default Microphone" },
      { deviceId: "mic-2", kind: "audioinput", label: "USB Podcast Microphone" },
    ]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

// Mock window.confirm
window.confirm = vi.fn(() => true);
