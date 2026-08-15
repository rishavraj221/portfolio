export type MessageStatus = "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  from: string;
  body: string;
  inserted_at: number;
  media_id: string | null;
}

export type MediaStatus = "pending" | "processing" | "ready" | "failed";

// Mirrors media-service's mediaView JSON shape (see demo/media-service
// internal/api/api.go), as proxied by WavelinkWeb.MediaController — url/
// thumbnail_url are short-lived signed URLs, re-resolved per fetch rather
// than cached long-term.
export interface ResolvedMedia {
  id: string;
  owner_id: string;
  status: MediaStatus;
  content_type: string;
  size_bytes: number;
  url?: string;
  thumbnail_url?: string;
}

export type MemberRole = "admin" | "member";

export interface Member {
  user_id: string;
  role: MemberRole;
  last_delivered_id: string | null;
  last_read_id: string | null;
}

export type ConversationType = "dm" | "group";

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  name: string;
  member_ids: string[];
  last_body: string | null;
  last_at: number | null;
  unread: number;
}

export interface DirectoryUser {
  username: string;
  online: boolean;
}
