defmodule WavelinkWeb.Presence do
  @moduledoc """
  Tracks who's actually connected right now, keyed by user id. Deliberately
  separate from `Wavelink.Directory` (who has ever registered) — presence is
  exactly the ephemeral, no-durability state the write-up describes: if a
  node restarts, presence rebuilds itself from live connections, nothing is
  replayed or backfilled.
  """
  use Phoenix.Presence,
    otp_app: :wavelink,
    pubsub_server: Wavelink.PubSub
end
