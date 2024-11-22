import styled from "styled-components";
import AudioRecorder from "./AudioRecorder";
import Transcription from "./Transcription";
import { useState } from "react";
import TranscribeHistory from "./TranscribeHistory";

const StyledLayout = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 1px;
`;

const AppLayout = () => {
  const [data, setData] = useState([]);
  return (
    <StyledLayout>
      <div className="flex flex-row content-center">
        <Transcription data={data} />
        <TranscribeHistory data={data} />
      </div>
      <div className="flex content-center items-center min-h-fit">
        <AudioRecorder setData={setData} />
      </div>
    </StyledLayout>
  );
};

export default AppLayout;
