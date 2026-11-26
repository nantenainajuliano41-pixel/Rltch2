import { useEffect, useState } from "react";
import type { Conversation, Peer } from "../types";
import { formatShortTime } from "../lib/format";
import { sanitizeSearchQuery } from "../lib/security";
import { Avatar } from "./Avatar";
import { CloseIcon, LockIcon, LogoutIcon, SearchIcon, Spinner } from "./Icons";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  activePeerId: string | null;
  username: string;
  searchResetKey: number;
  onSelectPeer: (peer: Peer) => void;
  onSearchUsers: (query: string) => Promise<{ users: Peer[]; error?: string }>;
  onSignOut: () => void;
  className?: string;
}

export function Sidebar({
  conversations,
  loading,
  error,
  activePeerId,
  username,
  searchResetKey,
  onSelectPeer,
  onSearchUsers,
  onSignOut,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Peer[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  // Vide la recherche dès que le premier message d'une nouvelle discussion est envoyé
  useEffect(() => {
    if (searchResetKey > 0) {
      setQuery("");
      setResults([]);
      setSearchError(null);
    }
  }, [searchResetKey]);

  const cleanQuery = sanitizeSearchQuery(query);
  const isSearchingMode = query.trim().length > 0;

  useEffect(() => {
    if (!cleanQuery) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      const res = await onSearchUsers(cleanQuery);
      if (cancelled) return;
      setSearching(false);
      if (res.error) {
        setSearchError(res.error);
        setResults([]);
      } else {
        setResults(res.users);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cleanQuery, onSearchUsers]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await onSignOut();
  };

  const handlePickResult = (peer: Peer) => {
    onSelectPeer(peer);
    if (conversations.some((c) => c.peer.id === peer.id)) {
      setQuery("");
      setResults([]);
    }
  };

  return (
    <aside className={`flex-col border-r border-slate-200 bg-white ${className}`}>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-900">Discussions</h1>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
            title="Discussions privées isolées par contrôle d'accès"
          >
            <LockIcon width={12} height={12} />
            Privé
          </span>
        </div>

        <div className="relative">
          <SearchIcon
            width={16}
            height={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={20}
            placeholder="Rechercher un pseudo…"
            aria-label="Rechercher un utilisateur par pseudo"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearchError(null);
              }}
              aria-label="Effacer la recherche"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <CloseIcon width={14} height={14} />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Liste des discussions">
        {isSearchingMode ? (
          <div>
            <p className="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Résultats de recherche
            </p>
            {!cleanQuery && (
              <p className="px-3 py-4 text-sm text-slate-500">
                Saisissez au moins 2 caractères pour rechercher un pseudo.
              </p>
            )}
            {searching && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Spinner className="h-4 w-4 text-indigo-500" />
                Recherche…
              </div>
            )}
            {searchError && (
              <p role="alert" className="m-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {searchError}
              </p>
            )}
            {cleanQuery && !searching && !searchError && results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                Aucun utilisateur trouvé pour « {cleanQuery} ».
              </p>
            )}
            <ul className="space-y-1">
              {results.map((user) => {
                const alreadyExists = conversations.some((c) => c.peer.id === user.id);
                const active = user.id === activePeerId;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handlePickResult(user)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Avatar name={user.username} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{user.username}</p>
                        <p className="text-xs text-slate-500">
                          {alreadyExists ? "Discussion existante" : "Démarrer une discussion"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Spinner className="h-5 w-5 text-indigo-500" />
                Chargement des discussions…
              </div>
            )}
            {error && (
              <p role="alert" className="m-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {!loading && !error && conversations.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700">Aucune discussion active</p>
                <p className="mt-1">
                  Recherchez le pseudo d'une personne ci-dessus et envoyez votre premier message.
                </p>
              </div>
            )}
            <ul className="space-y-1">
              {conversations.map((conv) => {
                const active = conv.peer.id === activePeerId;
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPeer(conv.peer)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        active
                          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Avatar name={conv.peer.username} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold text-slate-900">
                            {conv.peer.username}
                          </span>
                          {conv.last_message_at && (
                            <time
                              dateTime={conv.last_message_at}
                              className="shrink-0 text-[11px] text-slate-400"
                            >
                              {formatShortTime(conv.last_message_at)}
                            </time>
                          )}
                        </div>
                        {conv.last_message_preview && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {conv.last_message_preview}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-slate-200 p-3">
        <Avatar name={username} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{username}</p>
          <p className="text-xs text-emerald-600">Connecté</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          title="Se déconnecter"
        >
          {signingOut ? <Spinner className="h-4 w-4" /> : <LogoutIcon width={18} height={18} />}
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
