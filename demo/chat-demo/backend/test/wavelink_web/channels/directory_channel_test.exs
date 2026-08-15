defmodule WavelinkWeb.DirectoryChannelTest do
  use WavelinkWeb.ChannelCase

  defp username(tag), do: "#{tag}-#{System.unique_integer([:positive])}"

  defp connect_directory(user_id) do
    {:ok, reply, socket} =
      WavelinkWeb.UserSocket
      |> socket("user_socket:#{user_id}", %{user_id: user_id})
      |> subscribe_and_join(WavelinkWeb.DirectoryChannel, "directory:lobby")

    {reply, socket}
  end

  test "join returns every registered user" do
    alice = username("alice")
    Wavelink.Directory.register(alice)

    {reply, _socket} = connect_directory(username("bob"))

    assert alice in reply.users
  end

  test "joining tracks presence and pushes presence_state" do
    alice = username("alice")
    {_reply, _socket} = connect_directory(alice)

    assert_push "presence_state", state
    assert Map.has_key?(state, alice)
  end

  test "a second user joining broadcasts a presence diff to the first" do
    alice = username("alice")
    bob = username("bob")

    {_reply, _alice_socket} = connect_directory(alice)
    assert_push "presence_state", _state
    # Alice's own join is itself a presence_diff broadcast (to everyone
    # subscribed to the topic, including this test process) — drain it
    # before asserting on Bob's, or assert_broadcast picks up Alice's.
    assert_broadcast "presence_diff", %{joins: %{^alice => _}}

    {_reply, _bob_socket} = connect_directory(bob)

    assert_broadcast "presence_diff", %{joins: joins}
    assert Map.has_key?(joins, bob)
  end
end
