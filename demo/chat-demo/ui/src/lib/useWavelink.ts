import { useCallback, useEffect, useRef, useState } from "react";
import { Socket, type Channel } from "phoenix";
import type { ChatMessage, ConversationSummary, DirectoryUser, Member } from "./types";
import { notifyMessage } from "./notifications";

const SOCKET_URL = import.meta.env.VITE_BACKEND_WS_URL ?? "ws://localhost:4000/socket";

function newClientMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  return [...prev, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id.localeCompare(b.id));
}

function upsertConversation(prev: ConversationSummary[], next: ConversationSummary): ConversationSummary[] {
  const rest = prev.filter((c) => c.id !== next.id);
  return [next, ...rest];
}

interface ConversationTouched {
  conversation_id: string;
  from: string;
  body: string;
  message_id: string;
  inserted_at: number;
  type: ConversationSummary["type"];
  name: string;
  member_ids: string[];
}

/**
 * One socket for a registered user, carrying three channels: `user:<id>`
 * (the rooms list — see WavelinkWeb.InboxChannel), `directory:lobby` (the
 * contact list for starting new chats), and, only while a conversation is
 * actually open, `conversation:<id>` (that conversation's live messages
 * and read/delivered receipts). Joining a conversation channel on demand
 * rather than joining every conversation up front is what lets a user
 * belong to many conversations without the client subscribing to all of
 * them at once.
 */
export function useWavelink(userId: string | null, onNotificationClick?: (conversationId: string) => void) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const inboxRef = useRef<Channel | null>(null);
  const directoryRef = useRef<Channel | null>(null);
  const conversationRef = useRef<Channel | null>(null);
  const registeredRef = useRef<string[]>([]);
  const onlineRef = useRef<Set<string>>(new Set());
  // Which conversation is actually open right now — a ref (not just the
  // `activeConversationId` state) so the channel callbacks registered in
  // openConversation always see the current value without re-subscribing.
  const activeConversationRef = useRef<string | null>(null);
  const lastReadPushedRef = useRef<string | null>(null);
  const onNotificationClickRef = useRef(onNotificationClick);
  onNotificationClickRef.current = onNotificationClick;

  const recomputeUsers = useCallback(() => {
    setUsers(
      registeredRef.current
        .filter((u) => u !== userId)
        .map((u) => ({ username: u, online: onlineRef.current.has(u) })),
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const socket = new Socket(SOCKET_URL, { params: { user_id: userId } });
    socket.connect();
    socketRef.current = socket;

    const inbox = socket.channel(`user:${userId}`, {});
    inboxRef.current = inbox;

    inbox
      .join()
      .receive("ok", (reply: { conversations: ConversationSummary[] }) => setConversations(reply.conversations))
      .receive("error", (reply: { reason?: string }) => setError(reply.reason ?? "could not open your inbox"));

    inbox.on("conversation_touched", (payload: ConversationTouched) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === payload.conversation_id);
        const isOpenAndFocused = activeConversationRef.current === payload.conversation_id && document.hasFocus();
        const unreadDelta = payload.from !== userId && !isOpenAndFocused ? 1 : 0;

        const next: ConversationSummary = {
          id: payload.conversation_id,
          type: payload.type,
          name: payload.name,
          member_ids: payload.member_ids,
          last_body: payload.body,
          last_at: payload.inserted_at,
          unread: (existing?.unread ?? 0) + unreadDelta,
        };

        return upsertConversation(prev, next);
      });

      if (payload.from !== userId) {
        const isOpenAndFocused = activeConversationRef.current === payload.conversation_id && document.hasFocus();
        if (!isOpenAndFocused) {
          notifyMessage(
            {
              id: payload.message_id,
              conversation_id: payload.conversation_id,
              from: payload.from,
              body: payload.body,
              inserted_at: payload.inserted_at,
              media_id: null,
            },
            () => onNotificationClickRef.current?.(payload.conversation_id),
          );
        }
      }
    });

    // A group this user was just created into or added to — see
    // ConversationController. Only fires for someone other than whoever
    // triggered the REST call; that caller upserts its own copy directly
    // (see createGroup/addMember below), since they already have the
    // response and don't need to wait for their own broadcast to arrive.
    inbox.on("conversation_created", (payload: ConversationSummary) => {
      setConversations((prev) => upsertConversation(prev, { ...payload, last_body: null, last_at: null, unread: 0 }));
    });

    const directory = socket.channel("directory:lobby", {});
    directoryRef.current = directory;

    directory
      .join()
      .receive("ok", (reply: { users: string[] }) => {
        registeredRef.current = reply.users;
        recomputeUsers();
      })
      .receive("error", (reply: { reason?: string }) => setError(reply.reason ?? "could not load the directory"));

    directory.on("user_registered", (payload: { username: string }) => {
      if (!registeredRef.current.includes(payload.username)) {
        registeredRef.current = [...registeredRef.current, payload.username];
        recomputeUsers();
      }
    });

    directory.on("presence_state", (state: Record<string, unknown>) => {
      onlineRef.current = new Set(Object.keys(state));
      recomputeUsers();
    });

    directory.on(
      "presence_diff",
      (diff: { joins: Record<string, unknown>; leaves: Record<string, unknown> }) => {
        for (const id of Object.keys(diff.joins)) onlineRef.current.add(id);
        for (const id of Object.keys(diff.leaves)) onlineRef.current.delete(id);
        recomputeUsers();
      },
    );

    return () => {
      conversationRef.current?.leave();
      conversationRef.current = null;
      inbox.leave();
      directory.leave();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, recomputeUsers]);

  const openConversation = useCallback(
    (conversationId: string) => {
      const socket = socketRef.current;
      if (!socket || !userId) return;
      if (conversationRef.current && activeConversationRef.current === conversationId) return;

      conversationRef.current?.leave();
      setMessages([]);
      setMembers([]);
      lastReadPushedRef.current = null;
      activeConversationRef.current = conversationId;
      setActiveConversationId(conversationId);

      const channel = socket.channel(`conversation:${conversationId}`, {});
      conversationRef.current = channel;

      channel
        .join()
        .receive("ok", (reply: { messages: ChatMessage[]; members: Member[] }) => {
          setMessages(reply.messages);
          setMembers(reply.members);

          // Joining *is* "reached this device" for anything written while
          // this conversation wasn't open — one cursor push covers the
          // whole backlog, not one ack per message (see Store's moduledoc).
          const latestFromOthers = [...reply.messages].reverse().find((m) => m.from !== userId);
          if (latestFromOthers) channel.push("mark_delivered", { message_id: latestFromOthers.id });
        })
        .receive("error", (reply: { reason?: string }) => setError(reply.reason ?? "could not open that conversation"));

      channel.on("message", (payload: ChatMessage) => {
        setMessages((prev) => mergeMessages(prev, [payload]));

        if (payload.from !== userId) {
          channel.push("mark_delivered", { message_id: payload.id });
        }
      });

      channel.on(
        "ack",
        (payload: { client_msg_id?: string; message_id?: string; status: string; reason?: string }) => {
          if (payload.status === "rejected") {
            // The server refused to write the message at all (see
            // ConversationChannel.validate_media/2) — most commonly an
            // attachment the sender doesn't own or hasn't finished
            // uploading. Drop the optimistic bubble rather than leave it
            // stuck showing a single grey tick forever.
            setMessages((prev) => prev.filter((m) => m.id !== payload.client_msg_id));
            setError(payload.reason ?? "message could not be sent");
            return;
          }
          setMessages((prev) =>
            prev.map((m) =>
              payload.client_msg_id && m.id === payload.client_msg_id && payload.message_id
                ? { ...m, id: payload.message_id }
                : m,
            ),
          );
        },
      );

      channel.on("receipt", (payload: { user_id: string; status: "delivered" | "read"; message_id: string }) => {
        setMembers((prev) =>
          prev.map((m) => {
            if (m.user_id !== payload.user_id) return m;
            const field = payload.status === "read" ? "last_read_id" : "last_delivered_id";
            return { ...m, [field]: payload.message_id };
          }),
        );
      });

      channel.on("member_added", (payload: { user_id: string }) => {
        setMembers((prev) =>
          prev.some((m) => m.user_id === payload.user_id)
            ? prev
            : [...prev, { user_id: payload.user_id, role: "member", last_delivered_id: null, last_read_id: null }],
        );
      });

      channel.on("member_removed", (payload: { user_id: string }) => {
        setMembers((prev) => prev.filter((m) => m.user_id !== payload.user_id));
      });
    },
    [userId],
  );

  const closeConversation = useCallback(() => {
    conversationRef.current?.leave();
    conversationRef.current = null;
    activeConversationRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setMembers([]);
  }, []);

  const sendMessage = useCallback(
    (body: string, mediaId?: string) => {
      const channel = conversationRef.current;
      const conversationId = activeConversationRef.current;
      const trimmed = body.trim();
      if (!channel || !userId || !conversationId || (!trimmed && !mediaId)) return;

      const clientMsgId = newClientMsgId();
      const optimistic: ChatMessage = {
        id: clientMsgId,
        conversation_id: conversationId,
        from: userId,
        body: trimmed,
        inserted_at: Date.now(),
        media_id: mediaId ?? null,
      };
      setMessages((prev) => [...prev, optimistic]);
      channel.push("send_message", { body: trimmed, client_msg_id: clientMsgId, media_id: mediaId });
    },
    [userId],
  );

  // Call whenever the active conversation is the thing actually on screen
  // — on mount and again on every new message, same as before. Cheap to
  // call repeatedly: it's idempotent per latest-message-id and the server
  // cursor only ever moves forward (see Conversations.mark_read/3).
  const markRead = useCallback(() => {
    const channel = conversationRef.current;
    if (!channel || messages.length === 0) return;

    const latest = messages[messages.length - 1];
    if (latest.id === lastReadPushedRef.current) return;

    lastReadPushedRef.current = latest.id;
    channel.push("mark_read", { message_id: latest.id });

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationRef.current ? { ...c, unread: 0 } : c)),
    );
  }, [messages]);

  // Called after a REST call (create group / add member) that already has
  // the resulting conversation in hand — see the moduledoc note on
  // `conversation_created` above for why the caller doesn't wait for its
  // own broadcast.
  const noteConversation = useCallback((conversation: ConversationSummary) => {
    setConversations((prev) => upsertConversation(prev, conversation));
  }, []);

  return {
    conversations,
    users,
    messages,
    members,
    activeConversationId,
    error,
    openConversation,
    closeConversation,
    sendMessage,
    markRead,
    noteConversation,
  };
}
