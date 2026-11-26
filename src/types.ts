export interface Peer {
  id: string;
  username: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  peer: Peer;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
}

export interface RawConversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  user1?: { id: string; username: string } | { id: string; username: string }[] | null;
  user2?: { id: string; username: string } | { id: string; username: string }[] | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
