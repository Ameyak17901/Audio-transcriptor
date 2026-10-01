import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchCloudTranscripts,
  saveCloudTranscript,
  updateCloudTranscript,
  deleteCloudTranscript,
  syncGuestTranscripts,
} from "../transcriptDatabase";

describe("transcriptDatabase service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchCloudTranscripts calls /api/transcripts with Authorization Bearer header", async () => {
    const mockData = [
      { id: "tx_1", title: "Meeting 1", full_transcript: "Hello cloud" },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCloudTranscripts({ search: "cloud", limit: 10 }, "test-token-xyz");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledOptions = fetchMock.mock.calls[0][1];

    expect(calledUrl).toContain("/api/transcripts?search=cloud&limit=10");
    expect(calledOptions.headers["Authorization"]).toBe("Bearer test-token-xyz");
    expect(result).toEqual(mockData);
  });

  it("saveCloudTranscript posts payload with Authorization header", async () => {
    const payload = {
      title: "Audio Record",
      full_transcript: "Cloud persisted text",
      duration_seconds: 14.2,
    };
    const createdItem = { id: "tx_new_999", ...payload };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createdItem),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveCloudTranscript(payload, "test-token-xyz");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/transcripts");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer test-token-xyz");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(payload);
    expect(result).toEqual(createdItem);
  });

  it("updateCloudTranscript patches /api/transcripts/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "tx_123", full_transcript: "Updated text" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCloudTranscript("tx_123", { full_transcript: "Updated text" }, "token-abc");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/transcripts/tx_123");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(result.full_transcript).toBe("Updated text");
  });

  it("deleteCloudTranscript calls DELETE /api/transcripts/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const success = await deleteCloudTranscript("tx_del_456", "token-abc");
    expect(success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/transcripts/tx_del_456");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("syncGuestTranscripts posts guest items to /api/transcripts/sync-guest", async () => {
    const guestItems = [
      { title: "Guest 1", full_transcript: "Text 1" },
      { title: "Guest 2", full_transcript: "Text 2" },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: "g1" }, { id: "g2" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncGuestTranscripts(guestItems, "token-abc");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/transcripts/sync-guest");
    expect(result).toHaveLength(2);
  });
});
