import type { Conversation, Message, Peer, RawConversation } from "../types";

export const UNKNOWN_USER = "Utilisateur";

export function normalizeConversation(raw: RawConversation, myId: string): Conversation | null {
  if (raw.user1_id !== myId && raw.user2_id !== myId) {
    return null;
  }

  const u1 = Array.isArray(raw.user1) ? raw.user1[0] : raw.user1;
  const u2 = Array.isArray(raw.user2) ? raw.user2[0] : raw.user2;
  const isUser1 = raw.user1_id === myId;
  const peerId = isUser1 ? raw.user2_id : raw.user1_id;
  const peerProfile = isUser1 ? u2 : u1;

  const peer: Peer = {
    id: peerId,
    username: peerProfile?.username ?? UNKNOWN_USER,
  };

  return {
    id: raw.id,
    user1_id: raw.user1_id,
    user2_id: raw.user2_id,
    peer,
    last_message_at: raw.last_message_at,
    last_message_preview: raw.last_message_preview,
    created_at: raw.created_at,
  };
}

export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const tA = Date.parse(a.last_message_at ?? a.created_at);
    const tB = Date.parse(b.last_message_at ?? b.created_at);
    return tB - tA;
  });
}

export function upsertConversation(list: Conversation[], conv: Conversation): Conversation[] {
  const existingIdx = list.findIndex((c) => c.id === conv.id);
  if (existingIdx === -1) {
    return sortConversations([...list, conv]);
  }
  const next = [...list];
  next[existingIdx] = conv;
  return sortConversations(next);
}

export function byMessageDate(a: Message, b: Message): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function addUniqueMessage(list: Message[], msg: Message): Message[] {
  if (list.some((m) => m.id === msg.id)) return list;
  return [...list, msg].sort(byMessageDate);
}

export function mergeMessageHistory(local: Message[], fetched: Message[]): Message[] {
  const ids = new Set(fetched.map((m) => m.id));
  const newest = fetched.length ? Date.parse(fetched[fetched.length - 1].created_at) : 0;
  const extras = local.filter((m) => !ids.has(m.id) && Date.parse(m.created_at) > newest);
  return [...fetched, ...extras].sort(byMessageDate);
}
