const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

/**
 * Transcribes audio blob using Deepgram Speech-to-Text API
 * Uses modern 'nova-3' model with smart formatting and punctuation.
 * Routes through Vite proxy (/api/deepgram) in local dev to bypass CORS and ad-blockers.
 *
 * @param {Blob} audioBlob - Recorded or uploaded audio blob
 * @returns {Promise<Object>} - Deepgram response data
 */
export async function speechToText(audioBlob) {
  if (!apiKey) {
    throw new Error(
      "Missing Deepgram API key. Please configure VITE_DEEPGRAM_API_KEY in your .env file and restart your Vite server."
    );
  }

  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("Invalid audio data provided for transcription.");
  }

  // Guard against 0-byte or truncated recordings
  if (audioBlob.size < 500) {
    throw new Error(
      "The audio recording is too short or empty. Please record at least 1-2 seconds of speech."
    );
  }

  // Use Vite proxy in development if running locally, otherwise direct endpoint
  const isLocalDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const baseUrl = isLocalDev
    ? "/api/deepgram/v1/listen"
    : "https://api.deepgram.com/v1/listen";

  const apiUrl = `${baseUrl}?model=nova-3&smart_format=true&punctuate=true`;
  const contentType = audioBlob.type || "audio/webm";

  const options = {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
      Authorization: `Token ${apiKey.trim()}`,
    },
    body: audioBlob,
  };

  let response;
  try {
    response = await fetch(apiUrl, options);
  } catch (networkErr) {
    // If local proxy fails for any reason, fallback to direct call
    if (isLocalDev) {
      try {
        const directUrl = `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true`;
        response = await fetch(directUrl, options);
      } catch (fallbackErr) {
        throw new Error(
          `Network connection to Deepgram failed: ${fallbackErr.message || networkErr.message}`
        );
      }
    } else {
      throw new Error(`Network connection to Deepgram failed: ${networkErr.message}`);
    }
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail =
        errorJson.err_msg ||
        errorJson.message ||
        errorJson.error ||
        JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(
      `Deepgram API Error (${response.status}): ${errorDetail || response.statusText}`
    );
  }

  const data = await response.json();
  return data;
}
