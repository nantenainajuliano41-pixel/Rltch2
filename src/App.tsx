import { useCallback, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import { useConversations } from "./hooks/useConversations";
import type { Peer } from "./types";
import { AuthScreen } from "./components/AuthScreen";
import { ChatArea } from "./components/ChatArea";
import { ChatIcon, Spinner } from "./components/Icons";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar } from "./components/Sidebar";

function ChatLayout({ userId, username, onSignOut }: { userId: string; username: string; onSignOut: () => void }) {
  const {
    conversations,
    loading,
    error,
    searchUsers,
    registerLocalConversation,
  } = useConversations(userId);
  const [activePeer, setActivePeer] = useState<Peer | null>(null);
  const [searchResetKey, setSearchResetKey] = useState(0);
  // Sur mobile : true = liste des discussions, false = conversation
  const [showList, setShowList] = useState(true);

  // Sur ordinateur, ouvre automatiquement la discussion la plus récente s'il y en a une
  useEffect(() => {
    if (activePeer || conversations.length === 0) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      setActivePeer(conversations[0].peer);
      setShowList(false);
    }
  }, [conversations, activePeer]);

  const handleSelectPeer = useCallback((peer: Peer) => {
    if (peer.id === userId) return;
    setActivePeer(peer);
    setShowList(false);
  }, [userId]);

  const handleConversationCreated = useCallback(
    (conversationId: string, peer: Peer, content: string, createdAt: string) => {
      registerLocalConversation(conversationId, peer, content, createdAt);
      setSearchResetKey((k) => k + 1);
    },
    [registerLocalConversation]
  );

  const activeConversation = activePeer
    ? conversations.find((c) => c.peer.id === activePeer.id) ?? null
    : null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white">
      <Sidebar
        className={`${showList ? "flex" : "hidden"} w-full md:flex md:w-80 md:shrink-0`}
        conversations={conversations}
        loading={loading}
        error={error}
        activePeerId={activePeer?.id ?? null}
        username={username}
        searchResetKey={searchResetKey}
        onSelectPeer={handleSelectPeer}
        onSearchUsers={searchUsers}
        onSignOut={onSignOut}
      />

      <main className={`${showList ? "hidden" : "flex"} min-w-0 flex-1 md:flex`}>
        {activePeer ? (
          <ChatArea
            key={activePeer.id}
            conversationId={activeConversation?.id ?? null}
            peer={activePeer}
            me={{ id: userId, username }}
            onConversationCreated={handleConversationCreated}
            onBack={() => setShowList(true)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-6 text-center text-slate-500">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <ChatIcon width={32} height={32} />
            </div>
            <p className="font-semibold text-slate-700">Sélectionnez une discussion</p>
            <p className="mt-1 max-w-sm text-sm">
              Choisissez une conversation existante ou recherchez un pseudo dans la barre de recherche pour démarrer un échange privé.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Root() {
  const { session, user, username, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Spinner className="mr-2 h-6 w-6 text-indigo-500" />
        Chargement…
      </div>
    );
  }

  if (!session || !user) return <AuthScreen />;

  return <ChatLayout key={user.id} userId={user.id} username={username} onSignOut={signOut} />;
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
