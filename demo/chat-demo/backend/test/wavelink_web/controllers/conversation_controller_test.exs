defmodule WavelinkWeb.ConversationControllerTest do
  use WavelinkWeb.ConnCase, async: true

  alias Wavelink.Conversations

  defp user_id(tag), do: "#{tag}-#{System.unique_integer([:positive])}"

  defp as(conn, user_id), do: put_req_header(conn, "x-user-id", user_id)

  test "creating a group without x-user-id is rejected", %{conn: conn} do
    conn = post(conn, ~p"/api/conversations", %{"name" => "g", "member_ids" => ["bob"]})
    assert json_response(conn, 401)
  end

  test "creating a group returns the conversation and notifies the other members", %{conn: conn} do
    alice = user_id("alice")
    bob = user_id("bob")

    Phoenix.PubSub.subscribe(Wavelink.PubSub, "user:#{bob}")

    conn =
      conn
      |> as(alice)
      |> post(~p"/api/conversations", %{"name" => "trip", "member_ids" => [bob]})

    body = json_response(conn, 201)
    assert body["name"] == "trip"
    assert body["type"] == "group"
    assert alice in body["member_ids"]
    assert bob in body["member_ids"]

    assert_receive %Phoenix.Socket.Broadcast{event: "conversation_created", payload: %{id: id}}
    assert id == body["id"]
  end

  test "creating a group with a blank name is rejected", %{conn: conn} do
    conn =
      conn
      |> as(user_id("alice"))
      |> post(~p"/api/conversations", %{"name" => "  ", "member_ids" => ["bob"]})

    assert json_response(conn, 422)
  end

  test "a member can add another member", %{conn: conn} do
    alice = user_id("alice")
    bob = user_id("bob")
    carol = user_id("carol")
    {:ok, group} = Conversations.create_group("g", alice, [bob])

    conn =
      conn
      |> as(alice)
      |> post(~p"/api/conversations/#{group.id}/members", %{"user_id" => carol})

    body = json_response(conn, 200)
    assert carol in body["member_ids"]
  end

  test "a non-member can't add a member", %{conn: conn} do
    alice = user_id("alice")
    bob = user_id("bob")
    outsider = user_id("outsider")
    {:ok, group} = Conversations.create_group("g", alice, [bob])

    conn =
      conn
      |> as(outsider)
      |> post(~p"/api/conversations/#{group.id}/members", %{"user_id" => "dave"})

    assert json_response(conn, 403)
  end

  test "a member can remove another member", %{conn: conn} do
    alice = user_id("alice")
    bob = user_id("bob")
    {:ok, group} = Conversations.create_group("g", alice, [bob])

    conn =
      conn
      |> as(alice)
      |> delete(~p"/api/conversations/#{group.id}/members/#{bob}")

    assert json_response(conn, 200)
    refute Conversations.member?(group.id, bob)
  end
end
