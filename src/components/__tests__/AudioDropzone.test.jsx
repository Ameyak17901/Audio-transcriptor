import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AudioDropzone from "../AudioDropzone";

describe("AudioDropzone Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dropzone in initial upload prompt state", () => {
    render(<AudioDropzone onTranscribed={vi.fn()} />);

    expect(
      screen.getByText(/click to upload or drag & drop audio here/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/mp3, wav, m4a, ogg, webm, flac/i)
    ).toBeInTheDocument();
  });

  it("shows an error banner when file exceeds 25MB limit", () => {
    render(<AudioDropzone onTranscribed={vi.fn()} />);

    // Create mock oversized file (26MB)
    const largeFile = new File(["dummy content"], "large_audio.mp3", {
      type: "audio/mp3",
    });
    Object.defineProperty(largeFile, "size", { value: 26 * 1024 * 1024 });

    const dropRegion = screen.getByRole("region", {
      name: /audio file drop target/i,
    });

    fireEvent.drop(dropRegion, {
      dataTransfer: {
        files: [largeFile],
      },
    });

    expect(
      screen.getByText(/exceeds the 25mb maximum limit/i)
    ).toBeInTheDocument();
  });

  it("shows error when non-audio file is selected", () => {
    render(<AudioDropzone onTranscribed={vi.fn()} />);

    const docFile = new File(["sample pdf text"], "document.pdf", {
      type: "application/pdf",
    });

    const dropRegion = screen.getByRole("region", {
      name: /audio file drop target/i,
    });

    fireEvent.drop(dropRegion, {
      dataTransfer: {
        files: [docFile],
      },
    });

    expect(
      screen.getByText(/please select a supported audio file/i)
    ).toBeInTheDocument();
  });

  it("renders audio player preview and file name when valid audio file is dropped", () => {
    render(<AudioDropzone onTranscribed={vi.fn()} />);

    const audioFile = new File(["audio bits"], "sample_speech.wav", {
      type: "audio/wav",
    });
    Object.defineProperty(audioFile, "size", { value: 1024 * 500 }); // 500KB

    const dropRegion = screen.getByRole("region", {
      name: /audio file drop target/i,
    });

    fireEvent.drop(dropRegion, {
      dataTransfer: {
        files: [audioFile],
      },
    });

    expect(screen.getByText("sample_speech.wav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /transcribe file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });
});
