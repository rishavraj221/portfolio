import type { ConversationSummary } from "./types";

const API_URL = import.meta.env.VITE_BACKEND_HTTP_URL ?? "http://localhost:4000";

export type RegisterResult = { ok: true } | { ok: false; error: string };

// Claiming a username is the whole "sign up" here — no password, this is a
// demo of the messaging system, not an identity system. The server enforces
// uniqueness atomically, this is just the HTTP wrapper around it.
export async function register(username: string): Promise<RegisterResult> {
  try {
    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (res.ok) return { ok: true };

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? `request failed (${res.status})` };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export type ConversationResult = { ok: true; conversation: ConversationSummary } | { ok: false; error: string };

// x-user-id is the REST equivalent of the socket's user_id connect param —
// same no-real-auth shape, see WavelinkWeb.Plugs.RequireUserId.
function authedInit(userId: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", "x-user-id": userId, ...init.headers },
  };
}

async function conversationResult(res: Response): Promise<ConversationResult> {
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, conversation: body as ConversationSummary };
  return { ok: false, error: (body as { error?: string }).error ?? `request failed (${res.status})` };
}

export async function createGroup(userId: string, name: string, memberIds: string[]): Promise<ConversationResult> {
  try {
    const res = await fetch(
      `${API_URL}/api/conversations`,
      authedInit(userId, { method: "POST", body: JSON.stringify({ name, member_ids: memberIds }) }),
    );
    return await conversationResult(res);
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export async function addMember(userId: string, conversationId: string, newMemberId: string): Promise<ConversationResult> {
  try {
    const res = await fetch(
      `${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/members`,
      authedInit(userId, { method: "POST", body: JSON.stringify({ user_id: newMemberId }) }),
    );
    return await conversationResult(res);
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export async function removeMember(
  userId: string,
  conversationId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(targetId)}`,
      authedInit(userId, { method: "DELETE" }),
    );
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? `request failed (${res.status})` };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}
