import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPair,
  isValidUuid,
  sanitizeSearchQuery,
  validateMessageContent,
  validateUsername,
} from "./security";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

test("isValidUuid accepts valid UUIDs and rejects malformed or injected strings", () => {
  assert.equal(isValidUuid(UUID_A), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid(`${UUID_A},id.eq.1`), false);
  assert.equal(isValidUuid(null), false);
});

test("canonicalPair enforces deterministic ordering and blocks self-chat or invalid IDs", () => {
  assert.deepEqual(canonicalPair(UUID_B, UUID_A), [UUID_A, UUID_B]);
  assert.deepEqual(canonicalPair(UUID_A, UUID_B), [UUID_A, UUID_B]);
  assert.equal(canonicalPair(UUID_A, UUID_A), null);
  assert.equal(canonicalPair("bad", UUID_A), null);
});

test("sanitizeSearchQuery enforces min length 2, max 20, and strips control chars", () => {
  assert.equal(sanitizeSearchQuery("a"), null);
  assert.equal(sanitizeSearchQuery("   "), null);
  assert.equal(sanitizeSearchQuery("marie\n"), "marie");
  assert.equal(sanitizeSearchQuery("a".repeat(21)), null);
});

test("validateUsername rejects too-short, too-long, and strips newlines", () => {
  assert.equal(validateUsername("ab").valid, false);
  assert.equal(validateUsername("Marie\n").clean, "Marie");
  assert.equal(validateUsername("Marie").valid, true);
  assert.equal(validateUsername("x".repeat(21)).valid, false);
});

test("validateMessageContent rejects empty and oversized messages while preserving emojis", () => {
  assert.equal(validateMessageContent("   ").valid, false);
  assert.equal(validateMessageContent("Salut 😀🎉").valid, true);
  assert.equal(validateMessageContent("a".repeat(2001)).valid, false);
});
