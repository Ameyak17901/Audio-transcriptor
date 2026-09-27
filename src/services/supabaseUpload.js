/**
 * Direct-to-Supabase Storage Upload Service.
 *
 * Implements client-side direct streaming to Supabase Storage signed URLs.
 * Bypasses FastAPI server memory entirely (zero server RAM consumption),
 * avoiding payload limits and timeout bottlenecks on large audio files.
 */

const getBaseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/**
 * Requests a time-limited signed upload lease from the FastAPI backend.
 *
 * @param {string} filePath - Target storage path (e.g. "recordings/audio_123.webm")
 * @param {string} contentType - Audio MIME type
 * @returns {Promise<{signed_url: string, token: string, file_path: string, bucket: string}>}
 */
export async function getPresignedUploadUrl(filePath, contentType = "audio/webm") {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/uploads/presigned-url`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ file_path: filePath, content_type: contentType }),
  });

  if (!response.ok) {
    let errorMsg = "";
    try {
      const errJson = await response.json();
      errorMsg = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(`Failed to obtain upload authorization lease: ${errorMsg || response.statusText}`);
  }

  return response.json();
}

/**
 * Uploads an audio blob directly to Supabase Storage using a signed PUT URL.
 * Reports real-time upload progress percentage (0-100) via callback.
 *
 * @param {Blob} audioBlob - Audio binary data (WebM, WAV, MP4, etc.)
 * @param {string} [customPath] - Optional custom path inside the bucket
 * @param {(progress: number) => void} [onProgress] - Optional progress percentage callback
 * @returns {Promise<{file_path: string, bucket: string}>}
 */
export async function uploadAudioToSupabase(audioBlob, customPath = null, onProgress = null) {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("Invalid audio data provided for upload.");
  }

  // Determine file extension
  const mime = audioBlob.type || "audio/webm";
  let extension = "webm";
  if (mime.includes("wav")) extension = "wav";
  else if (mime.includes("mp4") || mime.includes("m4a")) extension = "mp4";
  else if (mime.includes("ogg")) extension = "ogg";
  else if (mime.includes("mp3") || mime.includes("mpeg")) extension = "mp3";

  const targetPath =
    customPath || `user_recordings/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;

  // 1. Get signed upload lease from backend
  const lease = await getPresignedUploadUrl(targetPath, mime);
  const uploadUrl = lease.signed_url;

  // 2. Perform direct binary PUT upload to Supabase Storage with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mime);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve({
          file_path: lease.file_path || targetPath,
          bucket: lease.bucket,
        });
      } else {
        reject(new Error(`Supabase upload failed with HTTP status ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during direct storage transfer to Supabase."));
    };

    xhr.onabort = () => {
      reject(new Error("Storage upload transfer was aborted."));
    };

    xhr.send(audioBlob);
  });
}

/**
 * Generates a signed download / streaming URL for in-browser playback or sharing.
 *
 * @param {string} filePath - Path of the audio file in the bucket
 * @param {number} [expiresIn=3600] - Expiration duration in seconds
 * @returns {Promise<string>} - Temporary signed download URL
 */
export async function getSignedDownloadUrl(filePath, expiresIn = 3600) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/uploads/signed-download-url`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ file_path: filePath, expires_in: expiresIn }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate signed download URL: ${response.statusText}`);
  }

  const data = await response.json();
  return data.download_url;
}

/**
 * Deletes an audio recording from Supabase Storage.
 *
 * @param {string} filePath - Path of the audio file to remove
 * @returns {Promise<boolean>}
 */
export async function deleteAudioFromSupabase(filePath) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/uploads/audio`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ file_path: filePath }),
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return Boolean(data.success);
}
