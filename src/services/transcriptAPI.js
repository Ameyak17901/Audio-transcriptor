/* eslint-disable no-undef */

const api_key = import.meta.env.VITE_DEEPGRAM_API_KEY

export async function speechToText(url) {
  const apiurl = "https://api.deepgram.com/v1/listen";

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "audio/wav",
      Accept: "application/json",
      authorization: `Token ${api_key}`,
    },
    body: url,
  };

  const data = await fetch(apiurl, options)
    .then((res) => res.json())
    .catch((err) => console.error(err));

  return data;
}
