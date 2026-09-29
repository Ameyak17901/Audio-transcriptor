import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startTranscriptionJob,
  getJobStatus,
  subscribeToJobSSE,
} from "../sseJobService";

describe("sseJobService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws error when neither filePath nor audioUrl is passed to startTranscriptionJob", async () => {
    await expect(startTranscriptionJob({})).rejects.toThrow(
      "Either 'filePath' or 'audioUrl' must be provided"
    );
  });

  it("calls /api/jobs/transcribe with POST and payload", async () => {
    const mockResponse = {
      job_id: "job_12345",
      status: "pending",
      progress: 0,
      stream_url: "/api/jobs/job_12345/stream",
      poll_url: "/api/jobs/job_12345",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startTranscriptionJob({
      filePath: "recordings/audio_99.webm",
      model: "nova-3",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs/transcribe");
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.file_path).toBe("recordings/audio_99.webm");
    expect(sentBody.model).toBe("nova-3");
    expect(result).toEqual(mockResponse);
  });

  it("retrieves job status via getJobStatus", async () => {
    const mockJob = {
      job_id: "job_abc",
      status: "processing",
      progress: 60,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJob),
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await getJobStatus("job_abc");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs/job_abc");
    expect(data.progress).toBe(60);
  });

  it("subscribes to EventSource events and triggers callbacks", () => {
    const listeners = {};
    const mockClose = vi.fn();

    class MockEventSource {
      constructor(url) {
        this.url = url;
        this.readyState = 1;
      }
      addEventListener(type, cb) {
        listeners[type] = cb;
      }
      close() {
        mockClose();
      }
    }

    vi.stubGlobal("EventSource", MockEventSource);

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const cleanup = subscribeToJobSSE("job_xyz", {
      onProgress,
      onComplete,
      onError,
    });

    expect(listeners["progress"]).toBeDefined();
    expect(listeners["complete"]).toBeDefined();
    expect(listeners["error"]).toBeDefined();

    // Trigger progress
    listeners["progress"]({
      data: JSON.stringify({ progress: 45, stage: "acoustic_modeling", message: "Processing" }),
    });
    expect(onProgress).toHaveBeenCalledWith({
      progress: 45,
      stage: "acoustic_modeling",
      message: "Processing",
    });

    // Trigger complete
    listeners["complete"]({
      data: JSON.stringify({
        status: "completed",
        result: { transcript: "Hello world via SSE" },
      }),
    });
    expect(onComplete).toHaveBeenCalledWith({ transcript: "Hello world via SSE" });
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Call manual cleanup
    cleanup();
  });
});
