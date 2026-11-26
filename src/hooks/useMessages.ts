import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { translateDbError } from "../lib/errors";
import { isValidUuid, validateMessageContent } from "../lib/security";
import { addUniqueMessage, mergeMessageHistory } from "../lib/conversation";
import type { Message, Peer } from "../types";

const HISTORY_LIMIT = 200;
const SELECT_FIELDS = "id, conversation_id, sender_id, content, created_at";

export function useMessages(
  conversationId: string | null,
  peer: Peer,
  me: { id: string; username: string },
  onConversationCreated: (conversationId: string, peer: Peer, content: string, createdAt: string) => void
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const meRef = useRef(me);
  const peerRef = useRef(peer);
  const onCreatedRef = useRef(onConversationCreated);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  useEffect(() => {
    onCreatedRef.current = onConversationCreated;
  }, [onConversationCreated]);

  useEffect(() => {
    setMessages([]);
    setError(null);

    if (!conversationId || !isValidUuid(conversationId)) {
      setLoading(false);
      setConnected(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setConnected(false);

    const fetchHistory = async (initial: boolean) => {
      const { data, error: err } = await supabase
        .from("messages")
        .select(SELECT_FIELDS)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;

      if (err) {
        if (initial) setError(translateDbError(err));
        setLoading(false);
        return;
      }

      const fetched = ((data ?? []) as Message[]).reverse();
      setError(null);
      setMessages((prev) => mergeMessageHistory(prev, fetched));
      setLoading(false);
    };

    void fetchHistory(true);

    const channel = supabase
      .channel(`dm:${conversationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          if (cancelled || row.conversation_id !== conversationId) return;
          setMessages((prev) => addUniqueMessage(prev, row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id || cancelled) return;
          setMessages((prev) => (prev.some((m) => m.id === id) ? prev.filter((m) => m.id !== id) : prev));
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void fetchHistory(false);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, me.id]);

  const send = useCallback(async (rawContent: string): Promise<{ error?: string }> => {
    const check = validateMessageContent(rawContent);
    if (!check.valid) return { error: check.error };

    const targetPeer = peerRef.current;
    const currentMe = meRef.current;
    if (!isValidUuid(targetPeer.id) || targetPeer.id === currentMe.id) {
      return { error: "Destinataire invalide." };
    }

    const { data, error: err } = await supabase.rpc("send_direct_message", {
      p_recipient_id: targetPeer.id,
      p_content: check.clean,
    });

    if (err) return { error: translateDbError(err) };
    const inserted = (Array.isArray(data) ? data[0] : data) as Message | undefined;
    if (!inserted) return { error: "Impossible d'envoyer le message." };

    setMessages((prev) => addUniqueMessage(prev, inserted));
    onCreatedRef.current(inserted.conversation_id, targetPeer, inserted.content, inserted.created_at);
    return {};
  }, []);

  const remove = useCallback(async (id: string): Promise<{ error?: string }> => {
    if (!isValidUuid(id)) return { error: "Identifiant de message invalide." };
    const { error: err } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("sender_id", meRef.current.id);
    if (err) return { error: translateDbError(err) };
    setMessages((prev) => prev.filter((m) => m.id !== id));
    return {};
  }, []);

  return { messages, loading, error, connected, send, remove };
}
