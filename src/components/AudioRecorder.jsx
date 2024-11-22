/* eslint-disable react/prop-types */

import styled from "styled-components";
import { speechToText } from "../services/transcriptAPI";
import { useRef, useState } from "react";

const StyledRecorder = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
`;

const AudioRecorder = ({ setData }) => {
  const [permissions, setPermissions] = useState(false);
  const mediaRecorder = useRef(null);
  const [recordingStatus, setRecordingStatus] = useState("inactive");
  const [stream, setStream] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [audio, setAudio] = useState(null);

  // get permission
  const getMicrophonePermissions = async () => {
    if ("MediaRecorder" in window) {
      try {
        const streamData = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setPermissions(true);
        setStream(streamData);
      } catch (error) {
        alert(error);
      }
    }
  };

  const startRecording = async () => {
    setRecordingStatus("recording");
    const media = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorder.current = media;
    mediaRecorder.current.start();
    let localAudioChunks = [];
    mediaRecorder.current.ondataavailable = (event) => {
      if (typeof event.data === "undefined") return;
      if (event.data.size === 0) return;
      localAudioChunks.push(event.data);
    };
    setAudioChunks(localAudioChunks);
    setPermissions(true);
  };

  const stopRecording = () => {
    setRecordingStatus("inactive");
    mediaRecorder.current.stop();
    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      setAudio(audioBlob);
      setAudioChunks([]);
    };
  };

  const downloadAudio = async () => {
    const data = await speechToText(audio);
    setData((prev) => [...prev, data]);
  };

  return (
    <StyledRecorder>
      {!permissions ? (
        <button
          className="bg-sky-400 hover:bg-sky-700 text-white p-1 rounded border-opacity-20"
          onClick={getMicrophonePermissions}
        >
          Get Microphone
        </button>
      ) : null}
      <div className="flex gap-x-4 mx-1">
        {permissions && recordingStatus === 'inactive'&& (
          <button
            className="bg-sky-400 hover:bg-sky-700 text-white p-1 rounded border-opacity-20"
            onClick={startRecording}
          >
            Start Recording
          </button>
        )}

        {permissions && recordingStatus === "recording" ? (
          <button
            className="bg-sky-400 hover:bg-sky-700 text-white p-1 rounded border-opacity-20"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        ) : null}

        <button
          className="bg-sky-400 hover:bg-sky-700 text-white p-1 rounded border-opacity-20"
          onClick={downloadAudio}
        >
          Transcribe
        </button>
      </div>
    </StyledRecorder>
  );
};

export default AudioRecorder;
