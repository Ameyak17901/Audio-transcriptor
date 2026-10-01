import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchCloudTranscripts,
  saveCloudTranscript,
  updateCloudTranscript,
  deleteCloudTranscript,
  syncGuestTranscripts,
} from "../services/transcriptDatabase";

const STORAGE_KEY = "audio_transcripts_history";
const MAX_HISTORY_ITEMS = 50;

/**
 * Custom hook to manage transcripts in both Supabase PostgreSQL (when authenticated)
 * and browser localStorage (for guest / offline mode).
 * Includes automatic guest-to-cloud migration upon user sign-in.
 */
export const useTranscriptions = () => {
  let auth = {};
  try {
    auth = useAuth() || {};
  } catch {
    auth = {};
  }
  const { user = null, token = null, isAuthenticated = false } = auth;

  const [transcripts, setTranscripts] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.error("Failed to load transcripts from localStorage:", err);
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync state changes to localStorage safely when in guest mode
  const persistTranscripts = useCallback(
    (items) => {
      if (isAuthenticated) return;
      try {
        const safeItems = items.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
      } catch (err) {
        console.error("Failed to persist transcripts to localStorage (quota exceeded?):", err);
      }
    },
    [isAuthenticated]
  );

  // Cloud Sync & Guest Migration Effect
  useEffect(() => {
    if (isAuthenticated && token) {
      let isMounted = true;
      setIsSyncing(true);

      const syncAndFetch = async () => {
        try {
          // 1. Check if there are local guest recordings to migrate
          const localStored = localStorage.getItem(STORAGE_KEY);
          let localItems = [];
          try {
            localItems = localStored ? JSON.parse(localStored) : [];
          } catch {
            localItems = [];
          }

          if (localItems.length > 0) {
            const formattedGuest = localItems.map((item) => ({
              title: item.title || "Guest Recording",
              audio_path: item.audio_path || item.storage_file_path || null,
              duration_seconds: item.metadata?.duration || item.duration_seconds || 0,
              confidence:
                item.confidence ||
                item.results?.channels?.[0]?.alternatives?.[0]?.confidence ||
                null,
              full_transcript:
                item.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
                item.transcript ||
                item.text ||
                "",
              raw_response: item,
            }));

            await syncGuestTranscripts(formattedGuest, token);
            localStorage.removeItem(STORAGE_KEY);
          }

          // 2. Load cloud transcripts from Supabase PostgreSQL
          const cloudData = await fetchCloudTranscripts({}, token);
          if (isMounted) {
            setTranscripts(cloudData);
          }
        } catch (err) {
          console.error("Error during cloud transcripts sync:", err);
        } finally {
          if (isMounted) setIsSyncing(false);
        }
      };

      syncAndFetch();

      return () => {
        isMounted = false;
      };
    } else {
      // Guest mode: load from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setTranscripts(stored ? JSON.parse(stored) : []);
      } catch {
        setTranscripts([]);
      }
    }
  }, [isAuthenticated, token]);

  // Sync across tabs/windows (guest mode only)
  useEffect(() => {
    if (isAuthenticated) return;

    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTranscripts(parsed);
          }
        } catch {
          // ignore corrupted data
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isAuthenticated]);

  // Add new transcript
  const addTranscript = useCallback(
    async (newTranscript) => {
      if (!newTranscript) return;

      // Defensive guard: resolve functional updaters if accidentally passed
      const resolved = typeof newTranscript === "function" ? newTranscript([]) : newTranscript;
      const rawItem = Array.isArray(resolved) ? resolved[0] : resolved;
      if (!rawItem || typeof rawItem !== "object") return;

      const fullText =
        rawItem.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        rawItem.transcript ||
        rawItem.text ||
        rawItem.full_transcript ||
        "";

      // 1. If authenticated, persist to Supabase PostgreSQL
      if (isAuthenticated && token) {
        try {
          const cloudPayload = {
            title: rawItem.title || "Untitled Recording",
            audio_path: rawItem.audio_path || rawItem.storage_file_path || null,
            duration_seconds: Number(rawItem.metadata?.duration || rawItem.duration_seconds || 0),
            confidence:
              rawItem.confidence ??
              rawItem.results?.channels?.[0]?.alternatives?.[0]?.confidence ??
              null,
            full_transcript: fullText,
            model: rawItem.model || "nova-3",
            language: rawItem.language || "en",
            raw_response: rawItem,
          };

          const savedItem = await saveCloudTranscript(cloudPayload, token);
          setTranscripts((prev) => [savedItem, ...prev.filter((i) => i.id !== savedItem.id)]);
          return;
        } catch (cloudErr) {
          console.warn("Cloud transcript save failed, falling back to local state:", cloudErr);
        }
      }

      // 2. Guest mode or cloud save fallback
      const normalizedItem = {
        ...rawItem,
        id:
          rawItem.id ||
          rawItem.metadata?.request_id ||
          `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: rawItem.createdAt || rawItem.metadata?.created || new Date().toISOString(),
      };

      setTranscripts((prev) => {
        const updated = [normalizedItem, ...prev.filter((item) => item.id !== normalizedItem.id)];
        persistTranscripts(updated);
        return updated;
      });
    },
    [isAuthenticated, token, persistTranscripts]
  );

  // Update transcript text (for inline editing)
  const updateTranscript = useCallback(
    async (id, updatedText) => {
      // 1. If authenticated, update Supabase PostgreSQL
      if (isAuthenticated && token) {
        try {
          await updateCloudTranscript(id, { full_transcript: updatedText }, token);
        } catch (err) {
          console.error("Failed to update transcript in cloud:", err);
        }
      }

      // 2. Update local state
      setTranscripts((prev) => {
        const updated = prev.map((item) => {
          if (item.id === id) {
            const channels = item.results?.channels || [];
            const updatedChannels = channels.map((ch, idx) => {
              if (idx === 0) {
                const alts = ch.alternatives || [];
                const updatedAlts = alts.map((alt, altIdx) => {
                  if (altIdx === 0) {
                    return { ...alt, transcript: updatedText };
                  }
                  return alt;
                });
                return { ...ch, alternatives: updatedAlts };
              }
              return ch;
            });

            return {
              ...item,
              full_transcript: updatedText,
              transcript: updatedText,
              results: { ...item.results, channels: updatedChannels },
              is_edited: true,
              metadata: {
                ...item.metadata,
                user_edited: true,
                editedAt: new Date().toISOString(),
              },
            };
          }
          return item;
        });

        persistTranscripts(updated);
        return updated;
      });
    },
    [isAuthenticated, token, persistTranscripts]
  );

  // Delete single transcript
  const deleteTranscript = useCallback(
    async (id) => {
      if (isAuthenticated && token) {
        try {
          await deleteCloudTranscript(id, token);
        } catch (err) {
          console.error("Failed to delete transcript from cloud:", err);
        }
      }

      setTranscripts((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistTranscripts(updated);
        return updated;
      });
    },
    [isAuthenticated, token, persistTranscripts]
  );

  // Clear all history
  const clearAllTranscripts = useCallback(async () => {
    setTranscripts([]);
    if (!isAuthenticated) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.error("Failed to clear localStorage:", err);
      }
    }
  }, [isAuthenticated]);

  // Filter transcripts by search query
  const filteredTranscripts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transcripts;

    return transcripts.filter((item) => {
      const text =
        item.full_transcript?.toLowerCase() ||
        item.transcript?.toLowerCase() ||
        item.results?.channels?.[0]?.alternatives?.[0]?.transcript?.toLowerCase() ||
        "";
      const title = item.title?.toLowerCase() || "";
      const dateStr = (item.createdAt || item.created_at)
        ? new Date(item.createdAt || item.created_at).toLocaleDateString().toLowerCase()
        : "";
      return text.includes(query) || title.includes(query) || dateStr.includes(query);
    });
  }, [transcripts, searchQuery]);

  return {
    transcripts,
    filteredTranscripts,
    searchQuery,
    setSearchQuery,
    addTranscript,
    updateTranscript,
    deleteTranscript,
    clearAllTranscripts,
    totalCount: transcripts.length,
    hasTranscripts: transcripts.length > 0,
    isAuthenticated,
    user,
    isSyncing,
  };
};
