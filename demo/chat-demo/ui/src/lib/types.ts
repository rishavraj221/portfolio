export type MessageStatus = "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  from: string;
  body: string;
  inserted_at: number;
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
