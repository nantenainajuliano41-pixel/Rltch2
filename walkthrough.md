# Security Summary

**Reviewed Files**: 14
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Cross-User Message Exposure | `supabase/schema.sql` | 200 | Original `messages` and `groups` SELECT policies used `using (true)`, allowing any authenticated user to read all chats across the app. | High | Fixed | Replaced groups with 1-on-1 `conversations` (`user1_id < user2_id`) and restricted `SELECT`, `INSERT`, and `DELETE` RLS policies exclusively to the two conversation participants (`auth.uid() = user1_id or auth.uid() = user2_id`). |
| Uncontrolled Conversation Creation & Metadata Tampering | `supabase/schema.sql` | 150 | Direct table inserts on chats could allow creating empty spam chats or forging `last_message_at` / preview metadata. | Medium | Fixed | Revoked `INSERT`, `UPDATE`, and `DELETE` privileges on `public.conversations` from `authenticated`; creation and message insertion now run through the `send_direct_message` `SECURITY DEFINER` function and automatic triggers. |
| Wildcard Pattern Scraping in Search | `supabase/schema.sql` | 112 | Unescaped `%`, `_`, and `\` characters in username search queries could allow dumping all profiles in a single query. | Medium | Fixed | Implemented `search_users_by_username` RPC requiring authentication, at least 2 query characters, escaped `LIKE` wildcards (`\`, `%`, `_`), and a strict `LIMIT 10`. |
| Unvalidated UUIDs & Native Confirm Dialog | `src/hooks/useMessages.ts`, `src/components/ChatArea.tsx` | 35, 65 | Conversation/message IDs were passed to Supabase filters without format validation, and `window.confirm` could be blocked in embedded frames. | Low | Fixed | Added `isValidUuid` checks before database queries/Realtime filters, participant checks in `normalizeConversation`, and inline delete confirmation in `ChatArea.tsx`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `src/lib/supabase.ts` | Uses only the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables; no `service_role` key or hardcoded secret exists in the codebase. |
| XSS / Unsafe HTML | `src/components/ChatArea.tsx`, `src/components/Sidebar.tsx` | All messages, previews, and usernames render via React text nodes with zero `dangerouslySetInnerHTML` or `innerHTML`. |
| Sender Impersonation | `supabase/schema.sql` | Both `send_direct_message` and `messages_insert_participant` RLS enforce `auth.uid() = sender_id` and prohibit self-messaging (`p_recipient_id = v_sender_id`). |
| Database Privileges | `supabase/schema.sql` | `anon` has zero table privileges; `force row level security` is enabled on `profiles`, `conversations`, and `messages`. |

## PoC Verification

### Unauthorized Access to Another User's Private Conversation
#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-User Data Access (IDOR) |
| Impact | High |
| Affected File | `supabase/schema.sql:220` |
| Test Scenario | User C queries `messages` or subscribes to Realtime using a `conversation_id` belonging to User A and User B, or calls `normalizeConversation` with a foreign row. |

#### How It Was Fixed
Row Level Security on `public.conversations` and `public.messages` checks `(c.user1_id = auth.uid() or c.user2_id = auth.uid())`, and `normalizeConversation` also drops any conversation payload where `myId` is neither `user1_id` nor `user2_id`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | User C submits a `SELECT` query or Realtime subscription targeting User A & B's `conversation_id`. | Request reaches PostgreSQL / Supabase Realtime with `auth.uid() = User C`. |
| 2 | RLS policy `messages_select_participants` checks `exists (select 1 from public.conversations c where c.id = conversation_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid()))`. | Predicate evaluates to `false`. |
| 3 | Database returns 0 rows and Realtime suppresses the event; client `normalizeConversation` returns `null`. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Neither database queries, Realtime subscriptions, nor client normalization expose messages or conversations to non-participants.

### Wildcard Scraping via Username Search
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unescaped Pattern Matching |
| Impact | Medium |
| Affected File | `supabase/schema.sql:112` |
| Test Scenario | Authenticated or anonymous caller submits `%` or `__` to `search_users_by_username` / `sanitizeSearchQuery`. |

#### How It Was Fixed
`sanitizeSearchQuery` rejects queries under 2 characters and strips control characters on the client, while `search_users_by_username` rejects `anon` callers, enforces `char_length >= 2`, escapes `\`, `%`, and `_`, and caps output at 10 rows.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Input `%` or `a%` enters `sanitizeSearchQuery` and `search_users_by_username`. | `%` is rejected (< 2 chars); `a%` is escaped to `a\%`. |
| 2 | PostgreSQL executes `p.username ilike '%' || v_escaped || '%' escape '\'`. | `%` matches only a literal percent sign, not all users. |
| 3 | Results remain empty or strictly matching, capped at 10 rows without emails. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unauthenticated callers are blocked and wildcard characters cannot be used to enumerate all accounts.
