/* eslint-disable react/prop-types */

import {useNavigate} from 'react-router-dom'

const TranscribeHistoryItem = ({ data }) => {
  
  const navigate = useNavigate()

  return (
    <div className="flex flex-col border-2 rounded-xl p-2 hover:bg-slate-300" onClick={() => {
      navigate('/transcript', {state: data})
    }}>
      {data?.results?.channels[0]?.alternatives[0]?.transcript}
      <div className="flex text-xs content-end">
        {
          new Date(`${data?.metadata?.created}`).toLocaleDateString(
            "en-US",
            { timeZoneName: "short", hour: '2-digit', minute: '2-digit', second: '2-digit' }
          )
        }
      </div>
    </div>
  );
};

export default TranscribeHistoryItem;
