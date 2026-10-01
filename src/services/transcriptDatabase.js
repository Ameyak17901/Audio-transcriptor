/**
 * Cloud Transcripts Database Service.
 *
 * Communicates with FastAPI /api/transcripts endpoints backed by Supabase PostgreSQL.
 * Automatically injects the Supabase JWT Bearer token for Row-Level Security.
 */

const getBaseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const getHeaders = (token) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Fetches user transcripts from Supabase PostgreSQL.
 *
 * @param {Object} [params]
 * @param {string} [params.search]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} token - Supabase JWT access token
 * @returns {Promise<Array<Object>>}
 */
export async function fetchCloudTranscripts(params = {}, token) {
  const baseUrl = getBaseUrl();
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

  const url = `${baseUrl}/api/transcripts${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cloud transcripts (${response.status}): ${response.statusText}`);
  }

  return response.json();
}

/**
 * Saves a new transcript record to Supabase PostgreSQL.
 *
 * @param {Object} transcriptData
 * @param {string} token - Supabase JWT access token
 * @returns {Promise<Object>}
 */
export async function saveCloudTranscript(transcriptData, token) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/transcripts`;

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(transcriptData),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      detail = await response.text();
    }
    throw new Error(`Failed to save transcript to cloud: ${detail || response.statusText}`);
  }

  return response.json();
}

/**
 * Updates an existing transcript title or text.
 *
 * @param {string} id
 * @param {Object} updates
 * @param {string} token
 * @returns {Promise<Object>}
 */
export async function updateCloudTranscript(id, updates, token) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/transcripts/${id}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update cloud transcript: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Deletes a transcript from PostgreSQL and deletes the associated audio from storage.
 *
 * @param {string} id
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function deleteCloudTranscript(id, token) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/transcripts/${id}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: getHeaders(token),
  });

  return response.ok;
}

/**
 * Bulk-syncs guest localStorage items into Supabase upon login.
 *
 * @param {Array<Object>} items
 * @param {string} token
 * @returns {Promise<Array<Object>>}
 */
export async function syncGuestTranscripts(items, token) {
  if (!items || !items.length) return [];

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/transcripts/sync-guest`;

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync guest transcripts: ${response.statusText}`);
  }

  return response.json();
}
