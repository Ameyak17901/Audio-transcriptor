/* eslint-disable no-undef */

const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

/**
 * Transcribes audio blob using Deepgram Speech-to-Text API
 * @param {Blob} audioBlob - Recorded or uploaded audio blob
 * @returns {Promise<Object>} - Deepgram response data
 */
export async function speechToText(audioBlob) {
  if (!apiKey) {
    throw new Error(
      "Missing Deepgram API key. Please configure VITE_DEEPGRAM_API_KEY in your .env file."
    );
  }

  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("Invalid audio data provided for transcription.");
  }

  const apiUrl = "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true";
  const contentType = audioBlob.type || "audio/webm";

  const options = {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
      Authorization: `Token ${apiKey}`,
    },
    body: audioBlob,
  };

  const response = await fetch(apiUrl, options);

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.err_msg || errorJson.message || JSON.stringify(errorJson);
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
