import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AudioDeviceSelector from "../AudioDeviceSelector";

describe("AudioDeviceSelector Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders microphone selector dropdown when multiple devices are found", async () => {
    const handleDeviceChange = vi.fn();

    render(
      <AudioDeviceSelector
        selectedDeviceId=""
        onDeviceChange={handleDeviceChange}
      />
    );

    const select = await screen.findByRole("combobox", {
      name: /select audio input device/i,
    });
    expect(select).toBeInTheDocument();
    expect(screen.getAllByText("Default Microphone").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("USB Podcast Microphone")).toBeInTheDocument();
  });

  it("triggers onDeviceChange and saves choice to localStorage on selection", async () => {
    const handleDeviceChange = vi.fn();

    render(
      <AudioDeviceSelector
        selectedDeviceId=""
        onDeviceChange={handleDeviceChange}
      />
    );

    const select = await screen.findByRole("combobox", {
      name: /select audio input device/i,
    });

    fireEvent.change(select, { target: { value: "mic-2" } });

    expect(handleDeviceChange).toHaveBeenCalledWith("mic-2");
    expect(localStorage.getItem("selected_audio_device_id")).toBe("mic-2");
  });

  it("returns null when 1 or fewer audio input devices are detected", async () => {
    vi.spyOn(navigator.mediaDevices, "enumerateDevices").mockResolvedValueOnce([
      { deviceId: "default", kind: "audioinput", label: "Single Mic" },
    ]);

    const { container } = render(
      <AudioDeviceSelector
        selectedDeviceId=""
        onDeviceChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
