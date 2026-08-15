defmodule WavelinkWeb.InboxChannel do
  @moduledoc """
  One topic per user, `user:<id>` — no longer where messages themselves
  travel (that's `WavelinkWeb.ConversationChannel` now, one topic per
  conversation), this is purely the "rooms list": which conversations this
  user is in, with a preview and unread count for each, kept live without
  requiring the client to join every conversation just to render the inbox.

  Two kinds of broadcast land here, both pushed straight through to the
  client by Phoenix's default channel forwarding (no `handle_out` needed,
  same as how `DirectoryChannel` gets away with none for presence):
  `conversation_touched` (a new message landed in one of this user's
  conversations — sent by `ConversationChannel`) and `conversation_created`
  (this user was just added to a group, or a DM was just opened with them —
  sent by `ConversationController`).

  Recomputing every conversation's preview/unread from the message log on
  every join, as `list_conversations/1` below does, is the naive version of
  this — a production system would maintain a denormalized "last message +
  unread count" alongside the membership row instead of re-scanning message
  history at login, the same kind of tradeoff `Wavelink.Conversations`
  already makes explicit for read cursors.
  """
  use WavelinkWeb, :channel

  alias Wavelink.Conversations
  alias Wavelink.Store

  @impl true
  def join("user:" <> user_id, _params, socket) do
    if user_id == socket.assigns.user_id do
      {:ok, %{conversations: list_conversations(user_id)}, socket}
    else
      {:error, %{reason: "can only join your own inbox"}}
    end
  end

  defp list_conversations(user_id) do
    user_id
    |> Conversations.list_for_user()
    |> Enum.map(&summarize(&1, user_id))
  end

  defp summarize(conversation, user_id) do
    members = Conversations.members(conversation.id)
    me = Enum.find(members, &(&1.user_id == user_id))
    member_ids = Enum.map(members, & &1.user_id)
    messages = Store.list_since(conversation.id, nil)
    last = List.last(messages)

    unread =
      Enum.count(messages, fn m ->
        m.from != user_id and (me.last_read_id == nil or m.id > me.last_read_id)
      end)

    %{
      id: conversation.id,
      type: conversation.type,
      name: Conversations.display_name(conversation, user_id),
      member_ids: member_ids,
      last_body: last && last.body,
      last_at: last && last.inserted_at,
      unread: unread
    }
  end
end
