defmodule WavelinkWeb.ConversationChannel do
  @moduledoc """
  One topic per conversation, `conversation:<id>` — a DM and a group are the
  same channel, since `Wavelink.Conversations` already resolved either down
  to one id. Every member's every open tab joins this topic directly, so
  fan-out to N members (and multi-tab/multi-device for each of them) is
  Phoenix PubSub delivering one broadcast to N subscribing sockets, not N
  writes to the store the way a per-recipient design would need — see
  `Wavelink.Store`'s moduledoc for the write side of that same tradeoff.

  Joining is authorized by membership: a group requires an existing
  `Wavelink.Conversations` row, a DM is created lazily the first time either
  side opens it (same "resume, don't reject" shape as registration).

  Delivered/read state is a per-member cursor (`Conversations.mark_delivered/3`,
  `mark_read/3`), not a flag on the message — so acking a whole backlog
  after being offline is one write, not one write per message.
  """
  use WavelinkWeb, :channel

  alias Wavelink.Conversations
  alias Wavelink.Store

  @impl true
  def join("conversation:" <> id, params, socket) do
    user_id = socket.assigns.user_id

    if authorized?(id, user_id) do
      since = Map.get(params, "since")
      backlog = Store.list_since(id, since)
      members = Conversations.members(id)
      socket = assign(socket, :conversation_id, id)

      {:ok,
       %{
         messages: Enum.map(backlog, &encode_message/1),
         members: Enum.map(members, &encode_member/1)
       }, socket}
    else
      {:error, %{reason: "not a member of this conversation"}}
    end
  end

  defp authorized?(id, user_id) do
    if Conversations.dm_id?(id) do
      case id |> String.trim_leading("dm:") |> String.split("|") do
        [a, b] when user_id in [a, b] ->
          {:ok, _conversation} = Conversations.get_or_create_dm(a, b)
          true

        _ ->
          false
      end
    else
      Conversations.member?(id, user_id)
    end
  end

  @impl true
  def handle_in("send_message", %{"body" => body, "client_msg_id" => cid}, socket) do
    from = socket.assigns.user_id
    conversation_id = socket.assigns.conversation_id
    {:ok, message} = Store.put_message(conversation_id, from, body)

    # Only the sending tab cares about this — swapping its optimistic id
    # for the real one. Every member (including the sender's other open
    # tabs) hears about the message itself via the broadcast below, since
    # they're all joined to this same topic.
    push(socket, "ack", %{client_msg_id: cid, message_id: message.id, status: "sent"})

    WavelinkWeb.Endpoint.broadcast!(
      "conversation:#{conversation_id}",
      "message",
      encode_message(message)
    )

    # A lightweight event, not a durable write — the message itself only
    # lives once, in the store above. This just tells every member's inbox
    # (whether or not that member currently has this conversation open) to
    # refresh its preview/unread count without re-fetching the whole
    # conversation list. Includes the conversation's own shape (type/name/
    # members) so a member seeing it for the first time — a DM just opened
    # at them, or a group they were added to but haven't reloaded their
    # inbox for — can render a row for it without a separate round trip;
    # name is computed per-recipient since a DM's name is "the other
    # member," which differs by who's asking.
    {:ok, conversation} = Conversations.get(conversation_id)
    members = Conversations.members(conversation_id)
    member_ids = Enum.map(members, & &1.user_id)

    for member <- members do
      WavelinkWeb.Endpoint.broadcast!("user:#{member.user_id}", "conversation_touched", %{
        conversation_id: conversation_id,
        from: from,
        body: body,
        message_id: message.id,
        inserted_at: message.inserted_at,
        type: conversation.type,
        name: Conversations.display_name(conversation, member.user_id),
        member_ids: member_ids
      })
    end

    {:noreply, socket}
  end

  def handle_in("mark_delivered", %{"message_id" => id}, socket),
    do: ack_cursor(socket, &Conversations.mark_delivered/3, "delivered", id)

  def handle_in("mark_read", %{"message_id" => id}, socket),
    do: ack_cursor(socket, &Conversations.mark_read/3, "read", id)

  defp ack_cursor(socket, cursor_fun, status, message_id) do
    conversation_id = socket.assigns.conversation_id
    user_id = socket.assigns.user_id
    :ok = cursor_fun.(conversation_id, user_id, message_id)

    WavelinkWeb.Endpoint.broadcast!("conversation:#{conversation_id}", "receipt", %{
      conversation_id: conversation_id,
      user_id: user_id,
      status: status,
      message_id: message_id
    })

    {:noreply, socket}
  end

  defp encode_message(message) do
    %{
      id: message.id,
      conversation_id: message.conversation_id,
      from: message.from,
      body: message.body,
      inserted_at: message.inserted_at
    }
  end

  defp encode_member(member) do
    %{
      user_id: member.user_id,
      role: member.role,
      last_delivered_id: member.last_delivered_id,
      last_read_id: member.last_read_id
    }
  end
end
