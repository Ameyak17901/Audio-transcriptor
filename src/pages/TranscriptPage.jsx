import { useLocation, useNavigate } from "react-router-dom"

const TranscriptPage = () => {
    const data = useLocation()
    const navigate = useNavigate()
    const item = data?.state
    console.log(data)
    return (
        <div className="flex flex-col border border-1 rounded-md min-w-56 w-fit min-h-80 max-h-80 h-64 items-center justify-center  bg-slate-100">
            <h3>Transcript</h3>
            <div className="flex justify-center items-end">
                {item?.results?.channels[0]?.alternatives[0]?.transcript}
            </div>
            <div className="flex flex-row justify-end">
                <button className=" flex bg-sky-600 hover:bg-sky-800 p-1 rounded-md" onClick={() => navigate('/', {state: item})}>Back</button>
            </div>
        </div>
    )
}

export default TranscriptPage