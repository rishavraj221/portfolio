import { useEffect, useState } from "react";
import { useWavelink } from "./lib/useWavelink";
import { dmId, dmPeer } from "./lib/conversationId";
import type { ConversationSummary } from "./lib/types";
import Register from "./components/Register";
import Inbox from "./components/Inbox";
import NewChatPanel from "./components/NewChatPanel";
import NewGroupPanel from "./components/NewGroupPanel";
import ChatWindow from "./components/ChatWindow";
import NotificationsPage from "./components/NotificationsPage";
import "./styles.css";

type View =
  | { name: "inbox" }
  | { name: "newChat" }
  | { name: "newGroup" }
  | { name: "chat"; conversationId: string }
  | { name: "notifications" };

function resolveConversation(
  conversations: ConversationSummary[],
  conversationId: string,
  userId: string,
): ConversationSummary | undefined {
  const existing = conversations.find((c) => c.id === conversationId);
  if (existing) return existing;

  // A DM the viewer just opened for the first time has no inbox row yet —
  // nothing's been sent in it, so no conversation_touched has fired. It's
  // still a valid conversation to view (the channel join will create the
  // membership), just one the client has to describe from its id alone.
  const peer = dmPeer(conversationId, userId);
  if (!peer) return undefined;

  return {
    id: conversationId,
    type: "dm",
    name: peer,
    member_ids: [userId, peer],
    last_body: null,
    last_at: null,
    unread: 0,
  };
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "inbox" });
  const {
    conversations,
    users,
    messages,
    members,
    error,
    openConversation,
    closeConversation,
    sendMessage,
    markRead,
    noteConversation,
  } = useWavelink(userId, (conversationId) => setView({ name: "chat", conversationId }));

  // Joins/leaves the conversation channel to match whatever's on screen —
  // the socket only ever subscribes to the one conversation currently
  // being viewed, not every conversation this user is in.
  useEffect(() => {
    if (view.name === "chat") {
      openConversation(view.conversationId);
    } else {
      closeConversation();
    }
    // openConversation/closeConversation are stable across renders (see
    // useWavelink), so this only re-runs when the viewed conversation does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (!userId) {
    return <Register onRegistered={setUserId} />;
  }

  return (
    <div className="shell">
      {error && <p className="error banner">{error}</p>}

      {view.name === "inbox" && (
        <Inbox
          userId={userId}
          conversations={conversations}
          users={users}
          onNewChat={() => setView({ name: "newChat" })}
          onNewGroup={() => setView({ name: "newGroup" })}
          onOpenChat={(conversationId) => setView({ name: "chat", conversationId })}
          onOpenNotifications={() => setView({ name: "notifications" })}
        />
      )}

      {view.name === "notifications" && (
        <NotificationsPage
          conversations={conversations}
          onOpenChat={(conversationId) => setView({ name: "chat", conversationId })}
          onBack={() => setView({ name: "inbox" })}
        />
      )}

      {view.name === "newChat" && (
        <NewChatPanel
          users={users}
          onClose={() => setView({ name: "inbox" })}
          onSelect={(peer) => setView({ name: "chat", conversationId: dmId(userId, peer) })}
        />
      )}

      {view.name === "newGroup" && (
        <NewGroupPanel
          userId={userId}
          users={users}
          onClose={() => setView({ name: "inbox" })}
          onCreated={(conversation) => {
            noteConversation(conversation);
            setView({ name: "chat", conversationId: conversation.id });
          }}
        />
      )}

      {view.name === "chat" && (
        <ChatWindow
          userId={userId}
          conversation={resolveConversation(conversations, view.conversationId, userId)}
          messages={messages}
          members={members}
          users={users}
          onSend={sendMessage}
          onMarkRead={markRead}
          onBack={() => setView({ name: "inbox" })}
        />
      )}
    </div>
  );
}
