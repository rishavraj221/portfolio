import { useMemo, useState } from "react";
import type { DirectoryUser } from "../lib/types";

export default function NewChatPanel({
  users,
  onSelect,
  onClose,
}: {
  users: DirectoryUser[];
  onSelect: (username: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? users.filter((u) => u.username.toLowerCase().includes(q)) : users;
    // Online first, then alphabetical within each group.
    return [...matches].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }, [users, query]);

  return (
    <div className="panel">
      <header>
        <button className="back" type="button" onClick={onClose}>
          ← Back
        </button>
        <span className="title">New chat</span>
      </header>

      <input
        autoFocus
        className="search"
        placeholder="Search registered users…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="userlist">
        {filtered.length === 0 && <p className="muted">No matching users.</p>}
        {filtered.map((u) => (
          <button key={u.username} type="button" className="userrow" onClick={() => onSelect(u.username)}>
            <span className={`dot ${u.online ? "online" : "offline"}`} />
            <span className="uname">{u.username}</span>
            <span className="status">{u.online ? "online" : "offline"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
