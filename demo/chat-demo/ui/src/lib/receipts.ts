import type { ChatMessage, Member, MessageStatus } from "./types";

// Derived, not stored — there's no per-message status anymore (see
// Wavelink.Store's moduledoc for why), so a tick is computed from the
// other members' read/delivered cursors each render. For a DM that's one
// other member, unambiguous. For a group it follows the same convention
// WhatsApp uses: delivered means *every* other member has it, read means
// *every* other member has read it — a single slow/offline member holds
// the whole tick at "sent," which is the real tradeoff of one shared tick
// for N people rather than a per-member breakdown.
export function messageStatus(message: ChatMessage, members: Member[], userId: string): MessageStatus | null {
  if (message.from !== userId) return null;

  const others = members.filter((m) => m.user_id !== userId);
  if (others.length === 0) return "sent";

  const allRead = others.every((m) => m.last_read_id !== null && m.last_read_id >= message.id);
  if (allRead) return "read";

  const allDelivered = others.every((m) => m.last_delivered_id !== null && m.last_delivered_id >= message.id);
  return allDelivered ? "delivered" : "sent";
}

// "Read by 2/4" — only worth showing for a group; a DM's tick already says
// the same thing with one glyph.
export function readSummary(message: ChatMessage, members: Member[], userId: string): string | null {
  const others = members.filter((m) => m.user_id !== userId);
  if (others.length < 2) return null;

  const read = others.filter((m) => m.last_read_id !== null && m.last_read_id >= message.id).length;
  return `Read ${read}/${others.length}`;
}
