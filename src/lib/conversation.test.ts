import test from "node:test";
import assert from "node:assert/strict";
import {
  addUniqueMessage,
  mergeMessageHistory,
  normalizeConversation,
  upsertConversation,
} from "./conversation";
import type { Message, RawConversation } from "../types";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

test("normalizeConversation rejects conversations where current user is not a participant", () => {
  const foreignConv: RawConversation = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user1_id: PEER,
    user2_id: OTHER,
    last_message_at: "2026-11-26T10:00:00Z",
    last_message_preview: "Secret",
    created_at: "2026-11-26T10:00:00Z",
  };
  assert.equal(normalizeConversation(foreignConv, ME), null);
});

test("normalizeConversation resolves the correct peer profile", () => {
  const raw: RawConversation = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user1_id: ME,
    user2_id: PEER,
    last_message_at: "2026-11-26T10:00:00Z",
    last_message_preview: "Bonjour 👋",
    created_at: "2026-11-26T10:00:00Z",
    user1: { id: ME, username: "Moi" },
    user2: { id: PEER, username: "Marie" },
  };
  const conv = normalizeConversation(raw, ME);
  assert.ok(conv);
  assert.equal(conv.peer.id, PEER);
  assert.equal(conv.peer.username, "Marie");
});

test("upsertConversation keeps most recently active conversations first without duplicates", () => {
  const c1 = normalizeConversation(
    {
      id: "c1",
      user1_id: ME,
      user2_id: PEER,
      last_message_at: "2026-11-26T10:00:00Z",
      last_message_preview: "Premier",
      created_at: "2026-11-26T10:00:00Z",
      user2: { id: PEER, username: "Marie" },
    },
    ME
  )!;
  const c2 = normalizeConversation(
    {
      id: "c2",
      user1_id: ME,
      user2_id: OTHER,
      last_message_at: "2026-11-26T11:00:00Z",
      last_message_preview: "Plus récent",
      created_at: "2026-11-26T11:00:00Z",
      user2: { id: OTHER, username: "Lucas" },
    },
    ME
  )!;

  let list = upsertConversation([], c1);
  list = upsertConversation(list, c2);
  assert.deepEqual(
    list.map((c) => c.id),
    ["c2", "c1"]
  );

  const c1Updated = { ...c1, last_message_at: "2026-11-26T12:00:00Z", last_message_preview: "Nouveau!" };
  list = upsertConversation(list, c1Updated);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, "c1");
});

test("addUniqueMessage and mergeMessageHistory prevent duplicates and preserve chronological order", () => {
  const m1: Message = {
    id: "m1",
    conversation_id: "c1",
    sender_id: ME,
    content: "Salut",
    created_at: "2026-11-26T10:00:00Z",
  };
  const m2: Message = {
    id: "m2",
    conversation_id: "c1",
    sender_id: PEER,
    content: "Coucou 😀",
    created_at: "2026-11-26T10:01:00Z",
  };

  let msgs = addUniqueMessage([], m2);
  msgs = addUniqueMessage(msgs, m1);
  msgs = addUniqueMessage(msgs, m1);
  assert.deepEqual(
    msgs.map((m) => m.id),
    ["m1", "m2"]
  );

  const merged = mergeMessageHistory([m2], [m1]);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["m1", "m2"]
  );
});
