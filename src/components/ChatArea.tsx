import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Peer } from "../types";
import { useMessages } from "../hooks/useMessages";
import { dayKey, formatDay, formatTime } from "../lib/format";
import { Avatar } from "./Avatar";
import { BackIcon, ChatIcon, LockIcon, Spinner, TrashIcon } from "./Icons";
import { MessageInput } from "./MessageInput";

interface Props {
  conversationId: string | null;
  peer: Peer;
  me: { id: string; username: string };
  onConversationCreated: (conversationId: string, peer: Peer, content: string, createdAt: string) => void;
  onBack: () => void;
}

export function ChatArea({ conversationId, peer, me, onConversationCreated, onBack }: Props) {
  const { messages, loading, error, connected, send, remove } = useMessages(
    conversationId,
    peer,
    me,
    onConversationCreated
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastPeerRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const peerChanged = lastPeerRef.current !== peer.id;
    if (loading && messages.length === 0) return;
    bottomRef.current?.scrollIntoView({
      behavior: peerChanged ? "auto" : "smooth",
      block: "end",
    });
    if (!loading) lastPeerRef.current = peer.id;
  }, [messages.length, loading, peer.id]);

  useEffect(() => {
    setActionError(null);
    setConfirmDeleteId(null);
  }, [peer.id, conversationId]);

  const handleConfirmDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setConfirmDeleteId(null);
    setActionError(null);
    const res = await remove(id);
    setDeletingId(null);
    if (res.error) setActionError(res.error);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          aria-label="Retour à la liste des discussions"
        >
          <BackIcon />
        </button>
        <Avatar name={peer.username} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-900">{peer.username}</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500" : "animate-pulse bg-amber-400"
              }`}
            />
            {connected ? "Discussion privée • Temps réel actif" : "Connexion en cours…"}
          </p>
        </div>
        <span
          className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex"
          title="Seuls vous et votre interlocuteur avez accès à ces messages"
        >
          <LockIcon width={12} height={12} />
          Privé
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
        {loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner className="h-5 w-5 text-indigo-500" />
            Chargement des messages…
          </div>
        )}

        {error && (
          <p role="alert" className="mx-auto max-w-md rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <ChatIcon width={28} height={28} />
            </div>
            <p className="font-semibold text-slate-700">
              Démarrez une discussion avec {peer.username}
            </p>
            <p className="mt-1 max-w-sm text-sm">
              Envoyez votre premier message ci-dessous. La conversation sera ensuite enregistrée dans votre liste.
            </p>
          </div>
        )}

        <ul className="mx-auto flex max-w-3xl flex-col">
          {messages.map((m, i) => {
            const mine = m.sender_id === me.id;
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const startsRun = newDay || prev.sender_id !== m.sender_id;

            return (
              <Fragment key={m.id}>
                {newDay && (
                  <li className="my-3 flex justify-center" aria-hidden="false">
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 capitalize">
                      {formatDay(m.created_at)}
                    </span>
                  </li>
                )}
                <li
                  className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${
                    startsRun ? "mt-3" : "mt-1"
                  }`}
                >
                  {!mine && (
                    <div className="w-8 shrink-0">{startsRun && <Avatar name={peer.username} size="sm" />}</div>
                  )}

                  <div className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                    <div className={`flex items-center gap-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Texte rendu par React : toujours échappé, jamais de HTML brut */}
                      <p
                        className={`min-w-0 px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
                          mine
                            ? "rounded-2xl rounded-br-md bg-indigo-600 text-white"
                            : "rounded-2xl rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200"
                        }`}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {m.content}
                      </p>
                      {mine && (
                        confirmDeleteId === m.id ? (
                          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(m.id)}
                              className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Supprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(m.id)}
                            disabled={deletingId === m.id}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label="Supprimer mon message"
                            title="Supprimer"
                          >
                            {deletingId === m.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <TrashIcon width={16} height={16} />
                            )}
                          </button>
                        )
                      )}
                    </div>
                    <time dateTime={m.created_at} className="mx-1 mt-0.5 text-[11px] text-slate-400">
                      {formatTime(m.created_at)}
                    </time>
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      {actionError && (
        <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {actionError}
        </p>
      )}

      <MessageInput chatKey={peer.id} peerName={peer.username} onSend={send} />
    </section>
  );
}
