import { useMemo } from "react";
import type { ConversationSummary } from "../lib/types";
import { formatTime } from "../lib/format";

// A "notification" here is just "a conversation with an unread count above
// zero" — that state already lives on the conversation summary (server-
// computed from the read cursor, see WavelinkWeb.InboxChannel), so this
// page is a filtered view over it rather than its own store.
export function unreadConversations(conversations: ConversationSummary[]): ConversationSummary[] {
  return conversations.filter((c) => c.unread > 0).sort((a, b) => (b.last_at ?? 0) - (a.last_at ?? 0));
}

export default function NotificationsPage({
  conversations,
  onOpenChat,
  onBack,
}: {
  conversations: ConversationSummary[];
  onOpenChat: (conversationId: string) => void;
  onBack: () => void;
}) {
  const unread = useMemo(() => unreadConversations(conversations), [conversations]);

  return (
    <div className="panel">
      <header>
        <button className="back" type="button" onClick={onBack}>
          ← Back
        </button>
        <span className="title">Notifications</span>
      </header>

      <div className="convolist">
        {unread.length === 0 && <p className="muted empty">Nothing new.</p>}
        {unread.map((c) => (
          <button key={c.id} type="button" className="convorow" onClick={() => onOpenChat(c.id)}>
            <span className="dot unread" />
            <span className="convoinfo">
              <span className="uname">{c.name}</span>
              <span className="preview">{c.last_body}</span>
            </span>
            <span className="convometa">
              {c.last_at && <span className="rowtime">{formatTime(c.last_at)}</span>}
              <span className="badge">{c.unread > 99 ? "99+" : c.unread}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
