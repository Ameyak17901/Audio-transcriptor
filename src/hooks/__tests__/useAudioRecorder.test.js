import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioRecorder, formatDuration, getSupportedMimeType } from "../useAudioRecorder";

describe("useAudioRecorder Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDuration helper", () => {
    it("formats 0 seconds as 00:00", () => {
      expect(formatDuration(0)).toBe("00:00");
    });

    it("formats seconds under a minute with leading zeros", () => {
      expect(formatDuration(5)).toBe("00:05");
      expect(formatDuration(42)).toBe("00:42");
    });

    it("formats minutes and seconds accurately", () => {
      expect(formatDuration(75)).toBe("01:15");
      expect(formatDuration(605)).toBe("10:05");
    });
  });

  describe("getSupportedMimeType helper", () => {
    it("returns supported audio MIME type string", () => {
      const mime = getSupportedMimeType();
      expect(typeof mime).toBe("string");
    });
  });

  describe("Recorder lifecycle state transitions", () => {
    it("initializes with idle status and clean state", () => {
      const { result } = renderHook(() => useAudioRecorder());

      expect(result.current.status).toBe("idle");
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isReviewing).toBe(false);
      expect(result.current.recordingSeconds).toBe(0);
      expect(result.current.formattedTime).toBe("00:00");
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.audioUrl).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("transitions from idle to recording on startRecording()", async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.status).toBe("recording");
      expect(result.current.isRecording).toBe(true);
      expect(result.current.mediaStream).not.toBeNull();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it("transitions from recording to reviewing on stopRecording() and generates audioUrl", async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.status).toBe("recording");

      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.status).toBe("reviewing");
      expect(result.current.isReviewing).toBe(true);
      expect(result.current.audioBlob).toBeInstanceOf(Blob);
      expect(result.current.audioUrl).toBe("blob:mock-audio-url");
    });

    it("resets all state back to idle on resetRecording()", async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.status).toBe("reviewing");

      act(() => {
        result.current.resetRecording();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.audioUrl).toBeNull();
      expect(result.current.recordingSeconds).toBe(0);
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it("captures microphone permission denial error gracefully", async () => {
      const notAllowedError = new Error("Permission denied");
      notAllowedError.name = "NotAllowedError";
      vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValueOnce(notAllowedError);

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toContain("Microphone permission was denied");
    });
  });
});
