import { useState, useEffect, useMemo, useCallback } from "react";

const STORAGE_KEY = "audio_transcripts_history";
const MAX_HISTORY_ITEMS = 50;

/**
 * Custom hook to manage persistent transcripts in localStorage
 * Includes quota safety, search filtering, and CRUD operations.
 */
export const useTranscriptions = () => {
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

  // Sync state changes to localStorage safely
  const persistTranscripts = useCallback((items) => {
    try {
      const safeItems = items.slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
    } catch (err) {
      console.error("Failed to persist transcripts to localStorage (quota exceeded?):", err);
    }
  }, []);

  // Sync across tabs/windows
  useEffect(() => {
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
  }, []);

  // Add new transcript
  const addTranscript = useCallback(
    (newTranscript) => {
      if (!newTranscript) return;

      const normalizedItem = {
        ...newTranscript,
        id:
          newTranscript.id ||
          newTranscript.metadata?.request_id ||
          `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: newTranscript.metadata?.created || new Date().toISOString(),
      };

      setTranscripts((prev) => {
        const updated = [normalizedItem, ...prev.filter((item) => item.id !== normalizedItem.id)];
        persistTranscripts(updated);
        return updated;
      });
    },
    [persistTranscripts]
  );

  // Update transcript text (for inline editing)
  const updateTranscript = useCallback(
    (id, updatedText) => {
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
              results: { ...item.results, channels: updatedChannels },
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
    [persistTranscripts]
  );

  // Delete single transcript
  const deleteTranscript = useCallback(
    (id) => {
      setTranscripts((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistTranscripts(updated);
        return updated;
      });
    },
    [persistTranscripts]
  );

  // Clear all history
  const clearAllTranscripts = useCallback(() => {
    setTranscripts([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear localStorage:", err);
    }
  }, []);

  // Filter transcripts by search query
  const filteredTranscripts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transcripts;

    return transcripts.filter((item) => {
      const text =
        item.results?.channels?.[0]?.alternatives?.[0]?.transcript?.toLowerCase() || "";
      const dateStr = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString().toLowerCase()
        : "";
      return text.includes(query) || dateStr.includes(query);
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
  };
};
