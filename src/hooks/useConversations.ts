import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { translateDbError } from "../lib/errors";
import { isValidUuid, sanitizeSearchQuery } from "../lib/security";
import {
  normalizeConversation,
  sortConversations,
  UNKNOWN_USER,
  upsertConversation,
} from "../lib/conversation";
import type { Conversation, Peer, RawConversation } from "../types";

const CONVERSATION_SELECT =
  "id, user1_id, user2_id, last_message_at, last_message_preview, created_at, user1:profiles!conversations_user1_id_fkey(id, username), user2:profiles!conversations_user2_id_fkey(id, username)";

export function useConversations(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (initial: boolean) => {
      if (!isValidUuid(userId)) {
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .not("last_message_at", "is", null)
        .order("last_message_at", { ascending: false });

      if (err) {
        if (initial) setError(translateDbError(err));
        if (initial) setLoading(false);
        return;
      }

      const normalized = ((data ?? []) as unknown as RawConversation[])
        .map((row) => normalizeConversation(row, userId))
        .filter((c): c is Conversation => c !== null);

      setError(null);
      setConversations((prev) => {
        let merged = sortConversations(normalized);
        for (const existing of prev) {
          if (existing.last_message_at && !merged.some((m) => m.id === existing.id)) {
            merged = upsertConversation(merged, existing);
          }
        }
        return merged;
      });
      if (initial) setLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;

    const runInitial = async () => {
      await load(true);
      if (cancelled) return;
    };
    void runInitial();

    const hydrateConversation = async (row: Omit<RawConversation, "user1" | "user2">) => {
      if (row.user1_id !== userId && row.user2_id !== userId) return;
      if (!row.last_message_at) return;

      const peerId = row.user1_id === userId ? row.user2_id : row.user1_id;
      let peerUsername = UNKNOWN_USER;

      if (isValidUuid(peerId)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", peerId)
          .maybeSingle();
        if (profile?.username) peerUsername = profile.username as string;
      }

      if (cancelled) return;

      const conv: Conversation = {
        id: row.id,
        user1_id: row.user1_id,
        user2_id: row.user2_id,
        peer: { id: peerId, username: peerUsername },
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview,
        created_at: row.created_at,
      };
      setConversations((prev) => upsertConversation(prev, conv));
    };

    const channel = supabase
      .channel(`conversations:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload) => {
          void hydrateConversation(payload.new as Omit<RawConversation, "user1" | "user2">);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload) => {
          void hydrateConversation(payload.new as Omit<RawConversation, "user1" | "user2">);
        }
      )
      .subscribe((status) => {
        if (!cancelled && status === "SUBSCRIBED") {
          void load(false);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const searchUsers = useCallback(
    async (rawQuery: string): Promise<{ users: Peer[]; error?: string }> => {
      const clean = sanitizeSearchQuery(rawQuery);
      if (!clean) return { users: [] };

      const { data, error: err } = await supabase.rpc("search_users_by_username", {
        p_query: clean,
      });

      if (err) return { users: [], error: translateDbError(err) };

      const users = ((data ?? []) as Peer[]).filter(
        (u) => isValidUuid(u.id) && u.id !== userId
      );
      return { users };
    },
    [userId]
  );

  const registerLocalConversation = useCallback(
    (convId: string, peer: Peer, preview: string, createdAt: string) => {
      if (!isValidUuid(convId) || !isValidUuid(peer.id) || peer.id === userId) return;
      const [u1, u2] = userId < peer.id ? [userId, peer.id] : [peer.id, userId];
      const conv: Conversation = {
        id: convId,
        user1_id: u1,
        user2_id: u2,
        peer,
        last_message_at: createdAt,
        last_message_preview: preview.slice(0, 100),
        created_at: createdAt,
      };
      setConversations((prev) => upsertConversation(prev, conv));
    },
    [userId]
  );

  return {
    conversations,
    loading,
    error,
    searchUsers,
    registerLocalConversation,
    refresh: () => load(false),
  };
}
