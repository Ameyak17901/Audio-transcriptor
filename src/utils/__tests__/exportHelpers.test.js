import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatSrtTimestamp,
  generateSrt,
  downloadFile,
  exportAsTxt,
  exportAsJson,
  exportAsSrt,
} from "../exportHelpers";

describe("exportHelpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatSrtTimestamp", () => {
    it("formats 0 seconds correctly to 00:00:00,000", () => {
      expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    });

    it("formats seconds with milliseconds correctly", () => {
      expect(formatSrtTimestamp(14.52)).toBe("00:00:14,520");
    });

    it("formats minutes and hours accurately", () => {
      // 1 hour, 2 minutes, 3 seconds and 450 ms
      const totalSeconds = 3600 + 120 + 3 + 0.45;
      expect(formatSrtTimestamp(totalSeconds)).toBe("01:02:03,450");
    });

    it("handles negative or invalid inputs with safe fallback", () => {
      expect(formatSrtTimestamp(-10)).toBe("00:00:00,000");
      expect(formatSrtTimestamp(null)).toBe("00:00:00,000");
      expect(formatSrtTimestamp("invalid")).toBe("00:00:00,000");
    });
  });

  describe("generateSrt", () => {
    it("returns empty string when data is null or malformed", () => {
      expect(generateSrt(null)).toBe("");
      expect(generateSrt({})).toBe("");
    });

    it("generates numbered subtitle blocks from paragraphs with sentences", () => {
      const mockData = {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "Hello world. This is a test.",
                  paragraphs: {
                    paragraphs: [
                      {
                        sentences: [
                          { text: "Hello world.", start: 1.0, end: 3.5 },
                          { text: "This is a test.", start: 4.0, end: 6.25 },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      };

      const srt = generateSrt(mockData);
      expect(srt).toContain("1\n00:00:01,000 --> 00:00:03,500\nHello world.");
      expect(srt).toContain("2\n00:00:04,000 --> 00:00:06,250\nThis is a test.");
    });

    it("generates grouped subtitle blocks from words when paragraphs are absent", () => {
      const mockData = {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "One two three four",
                  words: [
                    { word: "One", start: 0.5, end: 1.0 },
                    { word: "two", start: 1.1, end: 1.5 },
                    { word: "three", start: 1.6, end: 2.0 },
                    { word: "four", start: 2.1, end: 2.8 },
                  ],
                },
              ],
            },
          ],
        },
      };

      const srt = generateSrt(mockData);
      expect(srt).toContain("1\n00:00:00,500 --> 00:00:02,800\nOne two three four");
    });

    it("falls back to full transcript when neither paragraphs nor words exist", () => {
      const mockData = {
        metadata: { duration: 10.0 },
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "Simple fallback text",
                },
              ],
            },
          ],
        },
      };

      const srt = generateSrt(mockData);
      expect(srt).toContain("1\n00:00:00,000 --> 00:00:10,000\nSimple fallback text");
    });
  });

  describe("downloadFile and export helpers", () => {
    it("creates a link element and triggers click for download", () => {
      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      // Spy on document.createElement
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          el.click = clickSpy;
        }
        return el;
      });

      downloadFile("test content", "test.txt");

      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    });

    it("exportAsTxt extracts transcript text and triggers download", () => {
      const mockData = {
        results: {
          channels: [
            {
              alternatives: [{ transcript: "Plain text export test" }],
            },
          ],
        },
      };

      expect(() => exportAsTxt(mockData, "sample.txt")).not.toThrow();
    });

    it("exportAsJson formats JSON and triggers download", () => {
      const mockData = { id: "tx_123", results: {} };
      expect(() => exportAsJson(mockData, "sample.json")).not.toThrow();
    });

    it("exportAsSrt generates subtitles and triggers download", () => {
      const mockData = {
        results: {
          channels: [{ alternatives: [{ transcript: "Subtitle test" }] }],
        },
      };
      expect(() => exportAsSrt(mockData, "sample.srt")).not.toThrow();
    });
  });
});
