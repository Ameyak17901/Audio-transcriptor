/**
 * Utility functions for exporting transcripts to TXT, JSON, and SRT formats
 */

// Formats seconds (e.g. 14.52) to standard SRT format HH:MM:SS,mmm
export const formatSrtTimestamp = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const totalMs = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss},${mmm}`;
};

/**
 * Generates an SRT (SubRip) formatted string from Deepgram data.
 * Leverages sentence/paragraph timings or word-level timings when available.
 */
export const generateSrt = (data) => {
  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  if (!alternative) return "";

  const paragraphs = alternative.paragraphs?.paragraphs;
  const words = alternative.words;
  const fullTranscript = alternative.transcript || "";
  const totalDuration = data?.metadata?.duration || 5;

  const entries = [];

  // Strategy 1: Use sentence blocks from paragraphs if available
  if (paragraphs && paragraphs.length > 0) {
    let subtitleIndex = 1;
    for (const para of paragraphs) {
      if (para.sentences && para.sentences.length > 0) {
        for (const sentence of para.sentences) {
          entries.push(
            `${subtitleIndex++}\n${formatSrtTimestamp(sentence.start)} --> ${formatSrtTimestamp(
              sentence.end
            )}\n${sentence.text.trim()}\n`
          );
        }
      }
    }
  }

  // Strategy 2: Group words into ~7-word chunks if word timestamps exist
  if (entries.length === 0 && words && words.length > 0) {
    const CHUNK_SIZE = 7;
    let subtitleIndex = 1;
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunk = words.slice(i, i + CHUNK_SIZE);
      const start = chunk[0].start;
      const end = chunk[chunk.length - 1].end;
      const text = chunk.map((w) => w.punctuated_word || w.word).join(" ");
      entries.push(
        `${subtitleIndex++}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(
          end
        )}\n${text.trim()}\n`
      );
    }
  }

  // Strategy 3: Fallback for unsegmented single block
  if (entries.length === 0 && fullTranscript) {
    entries.push(
      `1\n${formatSrtTimestamp(0)} --> ${formatSrtTimestamp(
        totalDuration
      )}\n${fullTranscript.trim()}\n`
    );
  }

  return entries.join("\n");
};

/**
 * Triggers a file download in the browser
 */
export const downloadFile = (content, filename, mimeType = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Export transcript as plain text (.txt)
 */
export const exportAsTxt = (data, filename = "transcript.txt") => {
  const text =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  downloadFile(text, filename, "text/plain;charset=utf-8");
};

/**
 * Export raw transcript data as JSON (.json)
 */
export const exportAsJson = (data, filename = "transcript.json") => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, "application/json;charset=utf-8");
};

/**
 * Export transcript as SubRip subtitle (.srt)
 */
export const exportAsSrt = (data, filename = "transcript.srt") => {
  const srtContent = generateSrt(data);
  downloadFile(srtContent, filename, "text/plain;charset=utf-8");
};
