import { useEffect, useMemo, useState } from "react";
import type { ChatMessage, ConversationSummary, DirectoryUser, Member, MessageStatus } from "../lib/types";
import { formatTime } from "../lib/format";
import { messageStatus, readSummary } from "../lib/receipts";
import { addMember, removeMember } from "../lib/api";

function tick(status: MessageStatus) {
  // Same glyph for delivered/read, color (see styles.css) is what
  // distinguishes them — matching the real double-tick convention.
  return status === "sent" ? "✓" : "✓✓";
}

export default function ChatWindow({
  userId,
  conversation,
  messages,
  members,
  users,
  onSend,
  onMarkRead,
  onBack,
}: {
  userId: string;
  conversation: ConversationSummary | undefined;
  messages: ChatMessage[];
  members: Member[];
  users: DirectoryUser[];
  onSend: (body: string) => void;
  onMarkRead: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const online = conversation?.type === "dm" ? (users.find((u) => u.username === conversation.name)?.online ?? false) : null;
  const isGroup = conversation?.type === "group";

  const sorted = useMemo(() => [...messages].sort((a, b) => a.id.localeCompare(b.id)), [messages]);

  // Fires on mount (opening this chat) and again whenever a new message
  // arrives while it's already open — that's what "read" is supposed to
  // mean here: this specific conversation was actually on screen, not just
  // that a message landed somewhere in the inbox.
  useEffect(() => {
    onMarkRead();
  }, [messages, onMarkRead]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  async function handleAddMember(username: string) {
    if (!conversation) return;
    setAddError(null);
    const result = await addMember(userId, conversation.id, username);
    if (!result.ok) setAddError(result.error);
  }

  async function handleRemoveMember(username: string) {
    if (!conversation) return;
    await removeMember(userId, conversation.id, username);
  }

  if (!conversation) return null;

  const addableUsers = users.filter((u) => !members.some((m) => m.user_id === u.username));

  return (
    <div className="chat">
      <header>
        <button className="back" type="button" onClick={onBack}>
          ← Back
        </button>
        {online === null ? <span className="dot group" /> : <span className={`dot ${online ? "online" : "offline"}`} />}
        <span className="uname">{conversation.name}</span>
        {isGroup && (
          <button className="iconbtn" type="button" onClick={() => setShowMembers((v) => !v)}>
            {members.length} members
          </button>
        )}
      </header>

      {isGroup && showMembers && (
        <div className="memberpanel">
          <ul className="memberlist">
            {members.map((m) => (
              <li key={m.user_id}>
                <span className="uname">{m.user_id}</span>
                {m.role === "admin" && <span className="status">admin</span>}
                {m.user_id !== userId && (
                  <button className="iconbtn" type="button" onClick={() => handleRemoveMember(m.user_id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {addableUsers.length > 0 && (
            <div className="addmember">
              <span className="muted">Add:</span>
              {addableUsers.map((u) => (
                <button key={u.username} className="iconbtn" type="button" onClick={() => handleAddMember(u.username)}>
                  {u.username}
                </button>
              ))}
            </div>
          )}
          {addError && <p className="error">{addError}</p>}
        </div>
      )}

      <div className="messages">
        {sorted.map((m) => {
          const status = messageStatus(m, members, userId);
          const summary = isGroup && status ? readSummary(m, members, userId) : null;
          return (
            <div key={m.id} className={`bubble ${m.from === userId ? "mine" : "theirs"}`}>
              {isGroup && m.from !== userId && <span className="sender">{m.from}</span>}
              <span className="body">{m.body}</span>
              <span className="meta">
                <span className="time">{formatTime(m.inserted_at)}</span>
                {status && <span className={`tick ${status}`}>{tick(status)}</span>}
                {summary && <span className="readsummary">{summary}</span>}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="muted">No messages in {conversation.name} yet.</p>}
      </div>

      <form className="composer" onSubmit={handleSend}>
        <input
          autoFocus
          placeholder={`Message ${conversation.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
