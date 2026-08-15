// Mirrors Wavelink.Conversations.dm_id/2 on the backend — sorted so either
// side computes the same id without a lookup round trip, and the
// conversation itself gets created lazily the first time either one joins
// its channel topic.
export function dmId(userA: string, userB: string): string {
  return "dm:" + [userA, userB].sort().join("|");
}

// The other half of a DM id, from `viewerId`'s point of view — lets the UI
// show a peer name for a brand-new DM that hasn't produced a
// `conversation_touched` event (and so has no inbox row) yet.
export function dmPeer(conversationId: string, viewerId: string): string | null {
  if (!conversationId.startsWith("dm:")) return null;
  const [a, b] = conversationId.slice(3).split("|");
  return a === viewerId ? b : a;
}
