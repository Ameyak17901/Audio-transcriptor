/* eslint-disable react/prop-types */
import styled from "styled-components";
import TranscriptionItem from "./TranscriptionItem";

const StyledBox = styled.div`
  display: flex;
  height: 90vh;
  justify-content: center;
  max-width: 85vw;
  width: fit-content;
`;
const TranscriptionBox = styled.div`
  display: flex;
  flex-direction: column;
  margin: 1rem;
  align-items: flex-end;
  border: 1px solid black;
  justify-content: center;
  width: 85vw;
  padding-right: 5px;
  background-color: rgb(248 250 252);
  border-radius: 15px;
`;

const Trasnscription = ({ data }) => {
  return (
    <StyledBox>
      <TranscriptionBox>
        <div className="flex w-11/12 h-4/6 min-w-min items-end flex-col-reverse">
          <div className="flex items-end flex-col gap-y-1">
            {data.length > 0 ? (
              data.map((item, i) => (
                <TranscriptionItem
                  data={item}
                  key={item.metadata?.created || i}
                />
              ))
            ) : (
              <div>No transcripts found...</div>
            )}
          </div>
        </div>
      </TranscriptionBox>
    </StyledBox>
  );
};

export default Trasnscription;
