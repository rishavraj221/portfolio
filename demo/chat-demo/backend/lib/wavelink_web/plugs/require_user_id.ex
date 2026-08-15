defmodule WavelinkWeb.Plugs.RequireUserId do
  @moduledoc """
  Reads `x-user-id` and assigns it, the REST equivalent of the socket's
  `user_id` connect param (see `UserSocket.connect/3`) — same no-real-auth
  shape, just for the handful of conversation-management endpoints that
  need to know who's asking without a whole channel round-trip.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "x-user-id") do
      [user_id] when byte_size(user_id) > 0 ->
        assign(conn, :user_id, user_id)

      _ ->
        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "x-user-id header is required"})
        |> halt()
    end
  end
end
