/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";

const DEVICE_STORAGE_KEY = "selected_audio_device_id";

const AudioDeviceSelector = ({ selectedDeviceId, onDeviceChange, disabled = false }) => {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadDevices = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) return;

      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((device) => device.kind === "audioinput");

        if (isMounted) {
          setDevices(audioInputs);

          // Restore saved device if available and valid
          const savedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
          if (savedDevice && audioInputs.some((d) => d.deviceId === savedDevice)) {
            if (!selectedDeviceId && onDeviceChange) {
              onDeviceChange(savedDevice);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to enumerate audio devices:", err);
      }
    };

    loadDevices();

    // Listen for device plug/unplug events
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    }

    return () => {
      isMounted = false;
      if (navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
      }
    };
  }, [selectedDeviceId, onDeviceChange]);

  const handleChange = (e) => {
    const newId = e.target.value;
    if (onDeviceChange) {
      onDeviceChange(newId);
    }
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, newId);
    } catch {
      // ignore storage error
    }
  };

  // Only show dropdown if multiple microphones are available
  if (devices.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <svg
        className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
      <select
        value={selectedDeviceId || ""}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Select audio input device"
        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[200px] truncate"
      >
        <option value="">Default Microphone</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {device.label || `Microphone ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AudioDeviceSelector;
