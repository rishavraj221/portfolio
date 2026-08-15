import type { ConversationSummary, ResolvedMedia } from "./types";

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

export type MediaResult = { ok: true; media: ResolvedMedia } | { ok: false; error: string };

async function mediaResult(res: Response): Promise<MediaResult> {
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, media: body as ResolvedMedia };
  return { ok: false, error: (body as { error?: string }).error ?? `request failed (${res.status})` };
}

// Wavelink's backend proxies these three calls to media-service (see
// Wavelink.Media) — the browser never holds media-service's own service
// token. The one leg that *does* go straight from browser to storage is the
// PUT in uploadAttachment below: that URL is presigned specifically so this
// backend's own bandwidth isn't in the path for file bytes.
async function createMediaUpload(userId: string, contentType: string, sizeBytes: number): Promise<
  { ok: true; id: string; uploadUrl: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch(
      `${API_URL}/api/media`,
      authedInit(userId, { method: "POST", body: JSON.stringify({ content_type: contentType, size_bytes: sizeBytes }) }),
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: body.id as string, uploadUrl: body.upload_url as string };
    return { ok: false, error: (body as { error?: string }).error ?? `request failed (${res.status})` };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

async function completeMediaUpload(userId: string, id: string): Promise<MediaResult> {
  try {
    const res = await fetch(`${API_URL}/api/media/${encodeURIComponent(id)}/complete`, authedInit(userId, { method: "POST" }));
    return await mediaResult(res);
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export async function getMedia(userId: string, id: string): Promise<MediaResult> {
  try {
    const res = await fetch(`${API_URL}/api/media/${encodeURIComponent(id)}`, authedInit(userId));
    return await mediaResult(res);
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

// The full attachment flow: ask Wavelink's backend for an upload slot, PUT
// the bytes straight to object storage (bypassing both Wavelink's and
// media-service's own compute), then tell the backend it landed. Returns
// the media id to send along with the message, once it's at least
// `processing` — see ConversationChannel.validate_media/2 for why `pending`
// isn't good enough.
export async function uploadAttachment(userId: string, file: File): Promise<
  { ok: true; mediaId: string } | { ok: false; error: string }
> {
  const created = await createMediaUpload(userId, file.type, file.size);
  if (!created.ok) return created;

  try {
    const putRes = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) return { ok: false, error: `upload failed (${putRes.status})` };
  } catch {
    return { ok: false, error: "could not reach storage" };
  }

  const completed = await completeMediaUpload(userId, created.id);
  if (!completed.ok) return completed;
  return { ok: true, mediaId: completed.media.id };
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
