defmodule WavelinkWeb.RegistrationControllerTest do
  use WavelinkWeb.ConnCase, async: true

  defp username, do: "user-#{System.unique_integer([:positive])}"

  test "registering a new username returns 201", %{conn: conn} do
    name = username()
    conn = post(conn, ~p"/api/register", %{"username" => name})
    assert %{"username" => ^name} = json_response(conn, 201)
  end

  test "registering an already-registered username resumes it (200), not an error", %{conn: conn} do
    name = username()
    post(conn, ~p"/api/register", %{"username" => name})
    conn = post(conn, ~p"/api/register", %{"username" => name})
    assert %{"username" => ^name} = json_response(conn, 200)
  end

  test "resuming an existing username does not re-broadcast user_registered", %{conn: conn} do
    name = username()
    post(conn, ~p"/api/register", %{"username" => name})

    Phoenix.PubSub.subscribe(Wavelink.PubSub, "directory:lobby")
    post(conn, ~p"/api/register", %{"username" => name})

    refute_receive %Phoenix.Socket.Broadcast{event: "user_registered"}
  end

  test "registering a blank username returns 422", %{conn: conn} do
    conn = post(conn, ~p"/api/register", %{"username" => "  "})
    assert %{"error" => _} = json_response(conn, 422)
  end

  test "registering without a username returns 422", %{conn: conn} do
    conn = post(conn, ~p"/api/register", %{})
    assert %{"error" => _} = json_response(conn, 422)
  end

  test "registering broadcasts to the lobby, so already-connected clients see the new user", %{
    conn: conn
  } do
    Phoenix.PubSub.subscribe(Wavelink.PubSub, "directory:lobby")
    name = username()

    post(conn, ~p"/api/register", %{"username" => name})

    assert_receive %Phoenix.Socket.Broadcast{
      event: "user_registered",
      payload: %{username: ^name}
    }
  end
end
