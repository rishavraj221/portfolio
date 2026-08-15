defmodule Wavelink.Store do
  @moduledoc """
  The durable message log: every message is written here before any
  attempt to push it over a live connection, so delivery survives a dead
  socket, a crashed channel, or a recipient who simply isn't online yet.

  Keyed by conversation (partition) and message id (sort) — a DM and a
  group are the same shape here, since `Wavelink.Conversations` is what
  already resolved "conversation" down to a single id for either case (see
  `Conversations.dm_id/2`). There's deliberately no per-message delivery/
  read status anymore: that lived here when every conversation had exactly
  one other member, but doesn't generalize to N members without either
  O(members) writes per status change or an array field that grows with
  the group. `Wavelink.Conversations` tracks a `(conversation, user)`
  cursor instead — see its moduledoc for why that's the tradeoff that
  scales.

  Two implementations share this shape (partition = conversation, sort =
  message id) so swapping `Wavelink.Store.Memory` for `Wavelink.Store.Dynamo`
  is a config change, not a rewrite — see config/runtime.exs.
  """

  @type message :: %{
          id: String.t(),
          conversation_id: String.t(),
          from: String.t(),
          body: String.t(),
          inserted_at: integer(),
          media_id: String.t() | nil
        }

  @callback put_message(
              conversation_id :: String.t(),
              from :: String.t(),
              body :: String.t(),
              media_id :: String.t() | nil
            ) :: {:ok, message()}
  @callback list_since(conversation_id :: String.t(), since_id :: String.t() | nil) :: [message()]

  def impl, do: Application.get_env(:wavelink, :store, Wavelink.Store.Memory)

  def put_message(conversation_id, from, body, media_id \\ nil),
    do: impl().put_message(conversation_id, from, body, media_id)

  def list_since(conversation_id, since_id), do: impl().list_since(conversation_id, since_id)

  @doc """
  Sortable, roughly-monotonic id: millisecond timestamp plus a per-node
  unique integer, so ordering within one conversation holds without a
  global clock (same tradeoff the write-up describes for the real queue).
  """
  def new_id do
    ts = System.system_time(:millisecond)
    seq = System.unique_integer([:positive, :monotonic])
    "#{ts}-#{seq}"
  end
end
