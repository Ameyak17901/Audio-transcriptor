import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptions } from "../useTranscriptions";

describe("useTranscriptions Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("initializes with empty array when localStorage is empty", () => {
    const { result } = renderHook(() => useTranscriptions());
    expect(result.current.transcripts).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasTranscripts).toBe(false);
  });

  it("hydrates transcripts from localStorage if present", () => {
    const sampleItems = [
      {
        id: "tx_1",
        createdAt: "2026-09-23T10:00:00.000Z",
        results: {
          channels: [{ alternatives: [{ transcript: "Initial transcript" }] }],
        },
      },
    ];
    localStorage.setItem("audio_transcripts_history", JSON.stringify(sampleItems));

    const { result } = renderHook(() => useTranscriptions());
    expect(result.current.transcripts).toHaveLength(1);
    expect(result.current.transcripts[0].id).toBe("tx_1");
    expect(result.current.hasTranscripts).toBe(true);
  });

  it("addTranscript prepends item, assigns id, and saves to localStorage", () => {
    const { result } = renderHook(() => useTranscriptions());

    const newResult = {
      results: {
        channels: [{ alternatives: [{ transcript: "Newly transcribed audio" }] }],
      },
    };

    act(() => {
      result.current.addTranscript(newResult);
    });

    expect(result.current.transcripts).toHaveLength(1);
    expect(result.current.transcripts[0].results.channels[0].alternatives[0].transcript).toBe(
      "Newly transcribed audio"
    );
    expect(result.current.transcripts[0].id).toBeDefined();

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem("audio_transcripts_history"));
    expect(stored).toHaveLength(1);
    expect(stored[0].results.channels[0].alternatives[0].transcript).toBe(
      "Newly transcribed audio"
    );
  });

  it("updateTranscript updates transcript text and sets user_edited metadata", () => {
    const { result } = renderHook(() => useTranscriptions());

    act(() => {
      result.current.addTranscript({
        id: "tx_edit_test",
        results: {
          channels: [{ alternatives: [{ transcript: "Original typo" }] }],
        },
      });
    });

    act(() => {
      result.current.updateTranscript("tx_edit_test", "Corrected text");
    });

    const updated = result.current.transcripts.find((t) => t.id === "tx_edit_test");
    expect(updated.results.channels[0].alternatives[0].transcript).toBe("Corrected text");
    expect(updated.metadata.user_edited).toBe(true);

    // Verify persisted
    const stored = JSON.parse(localStorage.getItem("audio_transcripts_history"));
    expect(stored[0].results.channels[0].alternatives[0].transcript).toBe("Corrected text");
  });

  it("deleteTranscript removes specific item by ID", () => {
    const { result } = renderHook(() => useTranscriptions());

    act(() => {
      result.current.addTranscript({
        id: "item_1",
        results: { channels: [{ alternatives: [{ transcript: "Item 1" }] }] },
      });
      result.current.addTranscript({
        id: "item_2",
        results: { channels: [{ alternatives: [{ transcript: "Item 2" }] }] },
      });
    });

    expect(result.current.transcripts).toHaveLength(2);

    act(() => {
      result.current.deleteTranscript("item_1");
    });

    expect(result.current.transcripts).toHaveLength(1);
    expect(result.current.transcripts[0].id).toBe("item_2");
  });

  it("clearAllTranscripts empties state and clears localStorage", () => {
    const { result } = renderHook(() => useTranscriptions());

    act(() => {
      result.current.addTranscript({
        id: "item_1",
        results: { channels: [{ alternatives: [{ transcript: "Item 1" }] }] },
      });
    });

    expect(result.current.transcripts).toHaveLength(1);

    act(() => {
      result.current.clearAllTranscripts();
    });

    expect(result.current.transcripts).toHaveLength(0);
    expect(localStorage.getItem("audio_transcripts_history")).toBeNull();
  });

  it("filters transcripts in real time based on searchQuery", () => {
    const { result } = renderHook(() => useTranscriptions());

    act(() => {
      result.current.addTranscript({
        id: "tx_meeting",
        results: { channels: [{ alternatives: [{ transcript: "Weekly team sprint meeting" }] }] },
      });
      result.current.addTranscript({
        id: "tx_interview",
        results: { channels: [{ alternatives: [{ transcript: "Candidate technical interview" }] }] },
      });
    });

    expect(result.current.filteredTranscripts).toHaveLength(2);

    act(() => {
      result.current.setSearchQuery("sprint");
    });

    expect(result.current.filteredTranscripts).toHaveLength(1);
    expect(result.current.filteredTranscripts[0].id).toBe("tx_meeting");

    act(() => {
      result.current.setSearchQuery("NON_EXISTENT_KEYWORD");
    });

    expect(result.current.filteredTranscripts).toHaveLength(0);
  });

  it("enforces maximum quota ceiling of 50 items", () => {
    const { result } = renderHook(() => useTranscriptions());

    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.addTranscript({
          id: `id_${i}`,
          results: { channels: [{ alternatives: [{ transcript: `Transcript #${i}` }] }] },
        });
      }
    });

    const stored = JSON.parse(localStorage.getItem("audio_transcripts_history"));
    expect(stored.length).toBeLessThanOrEqual(50);
  });
});
