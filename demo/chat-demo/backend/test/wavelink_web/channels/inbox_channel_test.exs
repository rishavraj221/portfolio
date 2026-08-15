defmodule WavelinkWeb.InboxChannelTest do
  use WavelinkWeb.ChannelCase

  alias Wavelink.Conversations
  alias Wavelink.Store

  defp user_id(tag), do: "#{tag}-#{System.unique_integer([:positive])}"

  defp join_inbox(user_id) do
    {:ok, reply, socket} =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{user_id}", %{user_id: user_id})
      |> subscribe_and_join(WavelinkWeb.InboxChannel, "user:#{user_id}")

    {reply, socket}
  end

  test "joining someone else's inbox is refused" do
    alice = user_id("alice")
    bob = user_id("bob")

    result =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{alice}", %{user_id: alice})
      |> subscribe_and_join(WavelinkWeb.InboxChannel, "user:#{bob}")

    assert {:error, %{reason: _}} = result
  end

  test "join lists every conversation the user is a member of, with a preview and unread count" do
    alice = user_id("alice")
    bob = user_id("bob")

    {:ok, dm} = Conversations.get_or_create_dm(alice, bob)
    Store.put_message(dm.id, bob, "you up?")

    {reply, _socket} = join_inbox(alice)

    assert [summary] = reply.conversations
    assert summary.id == dm.id
    assert summary.type == :dm
    assert summary.name == bob
    assert summary.last_body == "you up?"
    assert summary.unread == 1
  end

  test "a group conversation uses its own name, not a member's" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, group} = Conversations.create_group("weekend plans", alice, [bob])

    {reply, _socket} = join_inbox(alice)

    assert [summary] = reply.conversations
    assert summary.id == group.id
    assert summary.name == "weekend plans"
    assert bob in summary.member_ids
  end

  test "a message you sent yourself doesn't count as unread" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, dm} = Conversations.get_or_create_dm(alice, bob)
    Store.put_message(dm.id, alice, "hi")

    {reply, _socket} = join_inbox(alice)

    assert [%{unread: 0}] = reply.conversations
  end

  test "marking a message read drops it out of the unread count" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, dm} = Conversations.get_or_create_dm(alice, bob)
    {:ok, message} = Store.put_message(dm.id, bob, "hi")

    Conversations.mark_read(dm.id, alice, message.id)

    {reply, _socket} = join_inbox(alice)
    assert [%{unread: 0}] = reply.conversations
  end
end
