import { useMemo, useState } from "react";
import TranscribeHistoryItem from "./TranscibeHistoryItem";

/*eslint-disable react/prop-types*/
const TranscribeHistory = ({ data }) => {
  const [transcibes, setTranscribes] = useState([]);

  useMemo(() => {
    setTranscribes(data);
  }, [data]);

  return (
    <div className="flex border border-1 min-w-44 my-4 rounded items-start content-end flex-col bg-slate-50 gap-y-1 p-2"  >
      {transcibes.length > 0 &&
        transcibes.map((item, i) => (
          <TranscribeHistoryItem
            key={item?.metadata?.request_id || i}
            data={item}
          />
        ))}
    </div>
  );
};

export default TranscribeHistory;
