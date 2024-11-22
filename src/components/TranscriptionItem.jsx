/*eslint-disable react/prop-types*/

const TranscriptionItem = ({ data }) => {
  return (
    <div className="border-2 rounded-xl p-4 flex flex-col  items-baseline h-fit hover:z-1 hover:cursor-pointer bg-slate-200 hover:animate-pulse">
      {data.results?.channels[0]?.alternatives[0]?.transcript}
    </div>
  );
};

export default TranscriptionItem;
