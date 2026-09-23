/**
 * Transcribes audio blob via the secure backend proxy (/api/transcribe).
 * Zero API keys are exposed to the client browser.
 *
 * @param {Blob} audioBlob - Recorded or uploaded audio blob
 * @returns {Promise<Object>} - Deepgram transcription data
 */
export async function speechToText(audioBlob) {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("Invalid audio data provided for transcription.");
  }

  // Guard against 0-byte or truncated recordings
  if (audioBlob.size < 500) {
    throw new Error(
      "The audio recording is too short or empty. Please record at least 1-2 seconds of speech."
    );
  }

  const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/api/transcribe?model=nova-3&smart_format=true&punctuate=true`;
  const contentType = audioBlob.type || "audio/webm";

  const options = {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: audioBlob,
  };

  let response;
  try {
    response = await fetch(apiUrl, options);
  } catch (networkErr) {
    throw new Error(
      `Cannot connect to backend server: ${networkErr.message}. Ensure the backend is running.`
    );
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail =
        errorJson.detail ||
        errorJson.err_msg ||
        errorJson.message ||
        JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(
      `Transcription Error (${response.status}): ${errorDetail || response.statusText}`
    );
  }

  const data = await response.json();
  return data;
}
