defmodule WavelinkWeb.ConversationChannelTest do
  use WavelinkWeb.ChannelCase

  alias Wavelink.Conversations

  defp user_id(tag), do: "#{tag}-#{System.unique_integer([:positive])}"

  defp connect_to(user_id, conversation_id) do
    {:ok, reply, socket} =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{user_id}", %{user_id: user_id})
      |> subscribe_and_join(WavelinkWeb.ConversationChannel, "conversation:#{conversation_id}")

    {reply, socket}
  end

  test "joining a DM topic lazily creates it for either side" do
    alice = user_id("alice")
    bob = user_id("bob")
    dm_id = Conversations.dm_id(alice, bob)

    {reply, _socket} = connect_to(alice, dm_id)
    assert reply.messages == []
    assert Conversations.member?(dm_id, alice)
    assert Conversations.member?(dm_id, bob)
  end

  test "a third party can't join someone else's DM" do
    alice = user_id("alice")
    bob = user_id("bob")
    carol = user_id("carol")
    dm_id = Conversations.dm_id(alice, bob)

    result =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{carol}", %{user_id: carol})
      |> subscribe_and_join(WavelinkWeb.ConversationChannel, "conversation:#{dm_id}")

    assert {:error, %{reason: _}} = result
  end

  test "joining a group requires existing membership" do
    alice = user_id("alice")
    bob = user_id("bob")
    carol = user_id("carol")
    {:ok, group} = Conversations.create_group("g", alice, [bob])

    result =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{carol}", %{user_id: carol})
      |> subscribe_and_join(WavelinkWeb.ConversationChannel, "conversation:#{group.id}")

    assert {:error, %{reason: _}} = result

    {reply, _socket} = connect_to(bob, group.id)
    assert reply.messages == []
    assert length(reply.members) == 2
  end

  test "a message is pushed to every member, including the sender's other tabs" do
    alice = user_id("alice")
    bob = user_id("bob")
    carol = user_id("carol")
    {:ok, group} = Conversations.create_group("g", alice, [bob, carol])

    {_reply, alice_socket} = connect_to(alice, group.id)
    {_reply, _bob_socket} = connect_to(bob, group.id)
    {_reply, _carol_socket} = connect_to(carol, group.id)
    # A second tab for alice, same as InboxChannel's old multi-tab test —
    # here it's just a second join to the same topic, no special-casing
    # needed since everyone (sender included) is a normal subscriber.
    Phoenix.PubSub.subscribe(Wavelink.PubSub, "conversation:#{group.id}")

    push(alice_socket, "send_message", %{"body" => "hi all", "client_msg_id" => "c1"})

    assert_push "ack", %{client_msg_id: "c1", status: "sent"}

    assert_receive %Phoenix.Socket.Broadcast{
      event: "message",
      payload: %{from: ^alice, body: "hi all"}
    }
  end

  test "sending a message touches every member's inbox topic, not just the recipients'" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)

    Phoenix.PubSub.subscribe(Wavelink.PubSub, "user:#{alice}")
    Phoenix.PubSub.subscribe(Wavelink.PubSub, "user:#{bob}")

    {_reply, alice_socket} = connect_to(alice, conversation.id)
    push(alice_socket, "send_message", %{"body" => "hey", "client_msg_id" => "c1"})
    assert_push "ack", %{status: "sent"}

    assert_receive %Phoenix.Socket.Broadcast{
      event: "conversation_touched",
      payload: %{from: ^alice}
    }

    assert_receive %Phoenix.Socket.Broadcast{
      event: "conversation_touched",
      payload: %{from: ^alice}
    }
  end

  test "mark_read advances the cursor and relays a receipt to the conversation" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)

    {_reply, alice_socket} = connect_to(alice, conversation.id)
    push(alice_socket, "send_message", %{"body" => "hey", "client_msg_id" => "c1"})
    assert_push "ack", %{message_id: message_id, status: "sent"}

    {_reply, bob_socket} = connect_to(bob, conversation.id)
    push(bob_socket, "mark_read", %{"message_id" => message_id})

    assert_broadcast "receipt", %{user_id: ^bob, status: "read", message_id: ^message_id}

    [bob_member] = Conversations.members(conversation.id) |> Enum.filter(&(&1.user_id == bob))
    assert bob_member.last_read_id == message_id
  end

  test "backlog is replayed on join, in order" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)

    {_reply, alice_socket} = connect_to(alice, conversation.id)
    push(alice_socket, "send_message", %{"body" => "one", "client_msg_id" => "c1"})
    assert_push "ack", %{status: "sent"}
    push(alice_socket, "send_message", %{"body" => "two", "client_msg_id" => "c2"})
    assert_push "ack", %{status: "sent"}

    {reply, _bob_socket} = connect_to(bob, conversation.id)
    assert [%{body: "one"}, %{body: "two"}] = reply.messages
  end
end
