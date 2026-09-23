import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { speechToText } from "../transcriptAPI";

describe("transcriptAPI service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws error when invalid or null audioBlob is passed", async () => {
    await expect(speechToText(null)).rejects.toThrow("Invalid audio data provided for transcription.");
    await expect(speechToText({})).rejects.toThrow("Invalid audio data provided for transcription.");
  });

  it("throws error when audioBlob is smaller than 500 bytes", async () => {
    const tinyBlob = new Blob(["short"], { type: "audio/webm" });
    await expect(speechToText(tinyBlob)).rejects.toThrow(
      "The audio recording is too short or empty. Please record at least 1-2 seconds of speech."
    );
  });

  it("calls fetch with relative path when VITE_API_URL is unset", async () => {
    const validBlob = new Blob([new Uint8Array(600)], { type: "audio/webm" });
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          channels: [{ alternatives: [{ transcript: "Hello world" }] }],
        },
      }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await speechToText(validBlob);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe("/api/transcribe?model=nova-3&smart_format=true&punctuate=true");
    expect(result.results.channels[0].alternatives[0].transcript).toBe("Hello world");
  });

  it("prepends VITE_API_URL when configured", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    const validBlob = new Blob([new Uint8Array(600)], { type: "audio/webm" });
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: { channels: [{ alternatives: [{ transcript: "Remote API test" }] }] },
      }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await speechToText(validBlob);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.example.com/api/transcribe?model=nova-3&smart_format=true&punctuate=true");
  });

  it("throws detailed error when response status is non-200", async () => {
    const validBlob = new Blob([new Uint8Array(600)], { type: "audio/webm" });
    const mockResponse = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ detail: "Audio format corrupted" }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(speechToText(validBlob)).rejects.toThrow("Transcription Error (400): Audio format corrupted");
  });

  it("handles network failure cleanly", async () => {
    const validBlob = new Blob([new Uint8Array(600)], { type: "audio/webm" });
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(speechToText(validBlob)).rejects.toThrow("Cannot connect to backend server: Connection refused");
  });
});
