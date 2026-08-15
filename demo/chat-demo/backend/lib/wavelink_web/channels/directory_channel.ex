defmodule WavelinkWeb.DirectoryChannel do
  @moduledoc """
  One shared topic, `directory:lobby`, that every connected client joins to
  drive the "new chat" contact list: who's registered (from
  `Wavelink.Directory`, durable) crossed with who's online right now (from
  `WavelinkWeb.Presence`, ephemeral). Presence's own join/leave broadcasts
  keep the online set live without us writing any diffing logic ourselves.
  """
  use WavelinkWeb, :channel

  alias Wavelink.Directory
  alias WavelinkWeb.Presence

  @impl true
  def join("directory:lobby", _params, socket) do
    send(self(), :after_join)
    {:ok, %{users: Directory.list()}, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    {:ok, _} =
      Presence.track(socket, socket.assigns.user_id, %{online_at: System.system_time(:second)})

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end
end
