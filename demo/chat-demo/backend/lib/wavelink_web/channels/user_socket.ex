defmodule WavelinkWeb.UserSocket do
  use Phoenix.Socket

  channel "user:*", WavelinkWeb.InboxChannel
  channel "conversation:*", WavelinkWeb.ConversationChannel
  channel "directory:*", WavelinkWeb.DirectoryChannel

  # No real auth for a demo — the client picks a user id, same as choosing a
  # display name. `check_origin` on the transport (see endpoint.ex) is what
  # actually restricts who can connect.
  @impl true
  def connect(%{"user_id" => user_id}, socket, _connect_info) when byte_size(user_id) > 0 do
    {:ok, assign(socket, :user_id, user_id)}
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
