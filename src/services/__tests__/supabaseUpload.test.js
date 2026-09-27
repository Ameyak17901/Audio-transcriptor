import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPresignedUploadUrl,
  uploadAudioToSupabase,
  getSignedDownloadUrl,
  deleteAudioFromSupabase,
} from "../supabaseUpload";

describe("supabaseUpload service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPresignedUploadUrl calls backend endpoint with target path and content type", async () => {
    const mockLease = {
      signed_url: "https://supabase.example.com/upload/sign/123",
      token: "123",
      file_path: "recordings/audio.webm",
      bucket: "audio-recordings",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLease),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPresignedUploadUrl("recordings/audio.webm", "audio/webm");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/uploads/presigned-url");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      file_path: "recordings/audio.webm",
      content_type: "audio/webm",
    });
    expect(result).toEqual(mockLease);
  });

  it("uploadAudioToSupabase rejects invalid blob", async () => {
    await expect(uploadAudioToSupabase(null)).rejects.toThrow("Invalid audio data provided for upload.");
    await expect(uploadAudioToSupabase("not-a-blob")).rejects.toThrow("Invalid audio data provided for upload.");
  });

  it("uploadAudioToSupabase executes PUT with XMLHttpRequest and tracks progress", async () => {
    const mockLease = {
      signed_url: "https://supabase.example.com/put-upload-url",
      token: "tok123",
      file_path: "user_recordings/custom.webm",
      bucket: "audio-recordings",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLease),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock XMLHttpRequest
    const mockXhr = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(function () {
        if (this.upload && this.upload.onprogress) {
          this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
        }
        this.status = 200;
        this.onload();
      }),
      upload: {},
      status: 200,
      statusText: "OK",
      onload: null,
      onerror: null,
    };
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => mockXhr));

    const progressCalls = [];
    const dummyBlob = new Blob([new Uint8Array(1024)], { type: "audio/webm" });

    const result = await uploadAudioToSupabase(dummyBlob, "user_recordings/custom.webm", (pct) => {
      progressCalls.push(pct);
    });

    expect(mockXhr.open).toHaveBeenCalledWith("PUT", mockLease.signed_url);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "audio/webm");
    expect(mockXhr.send).toHaveBeenCalledWith(dummyBlob);
    expect(progressCalls).toContain(50);
    expect(progressCalls).toContain(100);
    expect(result).toEqual({
      file_path: "user_recordings/custom.webm",
      bucket: "audio-recordings",
    });
  });

  it("getSignedDownloadUrl returns download URL from backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        download_url: "https://supabase.example.com/download/test.webm?token=abc",
        file_path: "user_recordings/test.webm",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = await getSignedDownloadUrl("user_recordings/test.webm", 3600);
    expect(url).toBe("https://supabase.example.com/download/test.webm?token=abc");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/uploads/signed-download-url");
  });

  it("deleteAudioFromSupabase deletes audio file via DELETE endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, file_path: "user_recordings/test.webm" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const success = await deleteAudioFromSupabase("user_recordings/test.webm");
    expect(success).toBe(true);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
