import { useMemo } from "react";
import type { ConversationSummary, DirectoryUser } from "../lib/types";
import { formatTime } from "../lib/format";

export default function Inbox({
  userId,
  conversations,
  users,
  onNewChat,
  onNewGroup,
  onOpenChat,
  onOpenNotifications,
}: {
  userId: string;
  conversations: ConversationSummary[];
  users: DirectoryUser[];
  onNewChat: () => void;
  onNewGroup: () => void;
  onOpenChat: (conversationId: string) => void;
  onOpenNotifications: () => void;
}) {
  const onlineByUser = useMemo(() => new Map(users.map((u) => [u.username, u.online])), [users]);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => (b.last_at ?? 0) - (a.last_at ?? 0)),
    [conversations],
  );

  const unreadCount = useMemo(() => conversations.reduce((sum, c) => sum + c.unread, 0), [conversations]);

  return (
    <div className="panel">
      <header>
        <span className="you">{userId}</span>
        <span className="headeractions">
          <button className="iconbtn" type="button" onClick={onOpenNotifications}>
            Notifications
            {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
          <button className="newchat" type="button" onClick={onNewGroup}>
            New group
          </button>
          <button className="newchat" type="button" onClick={onNewChat}>
            New chat
          </button>
        </span>
      </header>

      <div className="convolist">
        {sorted.length === 0 && (
          <p className="muted empty">No conversations yet. Start a new chat to say hello.</p>
        )}
        {sorted.map((c) => {
          const online = c.type === "dm" ? (onlineByUser.get(c.name) ?? false) : null;
          return (
            <button key={c.id} type="button" className="convorow" onClick={() => onOpenChat(c.id)}>
              {online === null ? (
                <span className="dot group" title={`${c.member_ids.length} members`} />
              ) : (
                <span className={`dot ${online ? "online" : "offline"}`} />
              )}
              <span className="convoinfo">
                <span className="uname">{c.name}</span>
                <span className="preview">{c.last_body ?? "No messages yet"}</span>
              </span>
              <span className="convometa">
                {c.last_at && <span className="rowtime">{formatTime(c.last_at)}</span>}
                {c.unread > 0 && <span className="badge">{c.unread > 99 ? "99+" : c.unread}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
