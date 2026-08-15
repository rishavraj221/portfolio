defmodule Wavelink.Conversations.MemoryTest do
  use ExUnit.Case, async: true

  alias Wavelink.Conversations

  defp user_id(tag), do: "#{tag}-#{System.unique_integer([:positive])}"

  test "get_or_create_dm makes both users members, symmetric on who calls it" do
    alice = user_id("alice")
    bob = user_id("bob")

    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)
    assert conversation.type == :dm
    assert Conversations.member?(conversation.id, alice)
    assert Conversations.member?(conversation.id, bob)

    {:ok, again} = Conversations.get_or_create_dm(bob, alice)
    assert again.id == conversation.id
  end

  test "get_or_create_dm is idempotent — same pair, same conversation" do
    alice = user_id("alice")
    bob = user_id("bob")

    {:ok, first} = Conversations.get_or_create_dm(alice, bob)
    {:ok, second} = Conversations.get_or_create_dm(alice, bob)

    assert first.id == second.id
  end

  test "create_group makes the creator an admin and every member id a member" do
    alice = user_id("alice")
    bob = user_id("bob")
    carol = user_id("carol")

    {:ok, conversation} = Conversations.create_group("trio", alice, [bob, carol])
    assert conversation.type == :group
    assert conversation.name == "trio"

    members = Conversations.members(conversation.id)
    assert length(members) == 3
    assert Enum.find(members, &(&1.user_id == alice)).role == :admin
    assert Enum.find(members, &(&1.user_id == bob)).role == :member
    assert Enum.find(members, &(&1.user_id == carol)).role == :member
  end

  test "add_member and remove_member change membership" do
    alice = user_id("alice")
    bob = user_id("bob")
    dave = user_id("dave")

    {:ok, conversation} = Conversations.create_group("g", alice, [bob])
    refute Conversations.member?(conversation.id, dave)

    assert :ok = Conversations.add_member(conversation.id, dave)
    assert Conversations.member?(conversation.id, dave)

    assert :ok = Conversations.remove_member(conversation.id, dave)
    refute Conversations.member?(conversation.id, dave)
  end

  test "add_member on an unknown conversation errors" do
    assert {:error, :not_found} = Conversations.add_member("nope", user_id("x"))
  end

  test "list_for_user returns every conversation that user is a member of" do
    alice = user_id("alice")
    bob = user_id("bob")

    {:ok, dm} = Conversations.get_or_create_dm(alice, bob)
    {:ok, group} = Conversations.create_group("g", alice, [bob])

    ids = Conversations.list_for_user(alice) |> Enum.map(& &1.id)
    assert dm.id in ids
    assert group.id in ids
  end

  test "mark_read and mark_delivered advance the calling user's cursor only" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)

    assert :ok = Conversations.mark_delivered(conversation.id, bob, "100-1")
    assert :ok = Conversations.mark_read(conversation.id, bob, "100-1")

    [bob_member] = Conversations.members(conversation.id) |> Enum.filter(&(&1.user_id == bob))
    [alice_member] = Conversations.members(conversation.id) |> Enum.filter(&(&1.user_id == alice))

    assert bob_member.last_delivered_id == "100-1"
    assert bob_member.last_read_id == "100-1"
    assert alice_member.last_delivered_id == nil
  end

  test "cursors never move backwards" do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, conversation} = Conversations.get_or_create_dm(alice, bob)

    Conversations.mark_read(conversation.id, bob, "200-1")
    Conversations.mark_read(conversation.id, bob, "100-1")

    [bob_member] = Conversations.members(conversation.id) |> Enum.filter(&(&1.user_id == bob))
    assert bob_member.last_read_id == "200-1"
  end
end
