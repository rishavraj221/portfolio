defmodule Wavelink.Conversations do
  @moduledoc """
  Who's in which conversation, and where each member has read/received up
  to. Separate from `Wavelink.Store` (which only ever holds message bodies)
  the same way `Directory` is separate from `Store` — this module owns
  membership and per-member cursors, not message content.

  A DM is just a conversation with exactly two members and a deterministic
  id (`dm_id/2`), created lazily the first time either party joins it — no
  separate "start a DM" step, matching the no-real-auth, resume-not-reject
  philosophy already used by registration. A group has an id handed out at
  creation time and members added/removed explicitly.

  Read/delivered state lives here as one cursor per `(conversation, user)`
  rather than a flag on every message, on purpose: advancing a cursor is
  one write regardless of how many messages it covers or how many members
  are in the conversation, where a per-message-per-member flag would cost
  O(members) writes per message and get worse as a group grows. The
  tradeoff is losing WhatsApp-style per-message delivered/read ticks for
  large groups; DMs (and small groups) can still derive an equivalent tick
  by comparing a message id against the other member's cursor, since
  message ids are lexicographically sortable (see `Wavelink.Store.new_id/0`).
  """

  @type role :: :admin | :member

  @type conversation :: %{
          id: String.t(),
          type: :dm | :group,
          name: String.t() | nil,
          created_by: String.t(),
          created_at: integer()
        }

  @type member :: %{
          conversation_id: String.t(),
          user_id: String.t(),
          role: role(),
          joined_at: integer(),
          last_delivered_id: String.t() | nil,
          last_read_id: String.t() | nil
        }

  @callback create_group(name :: String.t(), creator :: String.t(), member_ids :: [String.t()]) ::
              {:ok, conversation()}
  @callback get_or_create_dm(user_a :: String.t(), user_b :: String.t()) :: {:ok, conversation()}
  @callback get(conversation_id :: String.t()) :: {:ok, conversation()} | {:error, :not_found}
  @callback add_member(conversation_id :: String.t(), user_id :: String.t()) ::
              :ok | {:error, :not_found}
  @callback remove_member(conversation_id :: String.t(), user_id :: String.t()) ::
              :ok | {:error, :not_found}
  @callback members(conversation_id :: String.t()) :: [member()]
  @callback member?(conversation_id :: String.t(), user_id :: String.t()) :: boolean()
  @callback list_for_user(user_id :: String.t()) :: [conversation()]
  @callback mark_delivered(
              conversation_id :: String.t(),
              user_id :: String.t(),
              message_id :: String.t()
            ) ::
              :ok
  @callback mark_read(
              conversation_id :: String.t(),
              user_id :: String.t(),
              message_id :: String.t()
            ) ::
              :ok

  def impl, do: Application.get_env(:wavelink, :conversations, Wavelink.Conversations.Memory)

  def create_group(name, creator, member_ids), do: impl().create_group(name, creator, member_ids)
  def get_or_create_dm(user_a, user_b), do: impl().get_or_create_dm(user_a, user_b)
  def get(conversation_id), do: impl().get(conversation_id)
  def add_member(conversation_id, user_id), do: impl().add_member(conversation_id, user_id)
  def remove_member(conversation_id, user_id), do: impl().remove_member(conversation_id, user_id)
  def members(conversation_id), do: impl().members(conversation_id)
  def member?(conversation_id, user_id), do: impl().member?(conversation_id, user_id)
  def list_for_user(user_id), do: impl().list_for_user(user_id)

  def mark_delivered(conversation_id, user_id, message_id),
    do: impl().mark_delivered(conversation_id, user_id, message_id)

  def mark_read(conversation_id, user_id, message_id),
    do: impl().mark_read(conversation_id, user_id, message_id)

  @doc """
  Deterministic id for the DM between two users, independent of who
  initiates — sorted so `dm_id("a", "b") == dm_id("b", "a")`, which is what
  lets a DM be found (or lazily created) by either side without a lookup
  table just for that.
  """
  def dm_id(user_a, user_b) do
    "dm:" <> Enum.join(Enum.sort([user_a, user_b]), "|")
  end

  @doc "True for a conversation id shaped like `dm_id/2` produces."
  def dm_id?(conversation_id), do: String.starts_with?(conversation_id, "dm:")

  @doc """
  What `viewer_id` should call this conversation — the group's own name, or
  for a DM, whichever member isn't them. Viewer-relative on purpose, so a
  DM has no name to fetch and store, and it stays correct through renames
  (nonexistent) and membership changes without touching a stored field.
  """
  def display_name(%{type: :group, name: name}, _viewer_id), do: name

  def display_name(%{type: :dm} = conversation, viewer_id) do
    conversation.id
    |> members()
    |> Enum.map(& &1.user_id)
    |> Enum.find(&(&1 != viewer_id)) || viewer_id
  end

  @doc false
  def new_id do
    ts = System.system_time(:millisecond)
    seq = System.unique_integer([:positive, :monotonic])
    "group-#{ts}-#{seq}"
  end
end
