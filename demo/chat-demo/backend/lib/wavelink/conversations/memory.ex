defmodule Wavelink.Conversations.Memory do
  @moduledoc """
  In-memory stand-in for the two DynamoDB tables `Dynamo` uses, same shape
  (conversations by id; memberships by conversation_id + user_id). One
  GenServer owns both ETS tables so creating a group and inserting all its
  initial memberships happens under one process, same reasoning as
  `Wavelink.Store.Memory` — fine for a demo's traffic and test suite, not a
  claim about production concurrency.
  """
  @behaviour Wavelink.Conversations

  use GenServer

  alias Wavelink.Conversations

  @conversations :wavelink_conversations
  @memberships :wavelink_memberships

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl GenServer
  def init(:ok) do
    :ets.new(@conversations, [:set, :named_table, :public, read_concurrency: true])
    :ets.new(@memberships, [:ordered_set, :named_table, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl Wavelink.Conversations
  def create_group(name, creator, member_ids) do
    GenServer.call(__MODULE__, {:create_group, name, creator, member_ids})
  end

  @impl Wavelink.Conversations
  def get_or_create_dm(user_a, user_b) do
    id = Conversations.dm_id(user_a, user_b)

    case get(id) do
      {:ok, conversation} ->
        {:ok, conversation}

      {:error, :not_found} ->
        GenServer.call(__MODULE__, {:create_dm, id, user_a, user_b})
    end
  end

  @impl Wavelink.Conversations
  def get(conversation_id) do
    case :ets.lookup(@conversations, conversation_id) do
      [{^conversation_id, conversation}] -> {:ok, conversation}
      [] -> {:error, :not_found}
    end
  end

  @impl Wavelink.Conversations
  def add_member(conversation_id, user_id) do
    GenServer.call(__MODULE__, {:add_member, conversation_id, user_id})
  end

  @impl Wavelink.Conversations
  def remove_member(conversation_id, user_id) do
    case :ets.lookup(@memberships, {conversation_id, user_id}) do
      [] ->
        {:error, :not_found}

      _ ->
        :ets.delete(@memberships, {conversation_id, user_id})
        :ok
    end
  end

  @impl Wavelink.Conversations
  def members(conversation_id) do
    :ets.match_object(@memberships, {{conversation_id, :_}, :_})
    |> Enum.map(fn {_key, member} -> member end)
    |> Enum.sort_by(& &1.joined_at)
  end

  @impl Wavelink.Conversations
  def member?(conversation_id, user_id) do
    :ets.member(@memberships, {conversation_id, user_id})
  end

  @impl Wavelink.Conversations
  def list_for_user(user_id) do
    :ets.tab2list(@memberships)
    |> Enum.filter(fn {{_cid, uid}, _member} -> uid == user_id end)
    |> Enum.map(fn {{cid, _uid}, _member} -> get(cid) end)
    |> Enum.flat_map(fn
      {:ok, conversation} -> [conversation]
      {:error, :not_found} -> []
    end)
    |> Enum.sort_by(& &1.created_at, :desc)
  end

  @impl Wavelink.Conversations
  def mark_delivered(conversation_id, user_id, message_id) do
    bump_cursor(conversation_id, user_id, :last_delivered_id, message_id)
  end

  @impl Wavelink.Conversations
  def mark_read(conversation_id, user_id, message_id) do
    bump_cursor(conversation_id, user_id, :last_read_id, message_id)
  end

  defp bump_cursor(conversation_id, user_id, field, message_id) do
    case :ets.lookup(@memberships, {conversation_id, user_id}) do
      [{key, member}] ->
        # Monotonic on purpose: a "read" ack for an older message (e.g. a
        # backlog replay racing a live one) should never move the cursor
        # backwards and regress an already-advanced tick.
        current = Map.get(member, field)

        if current == nil or message_id > current do
          :ets.insert(@memberships, {key, Map.put(member, field, message_id)})
        end

        :ok

      [] ->
        :ok
    end
  end

  @impl GenServer
  def handle_call({:create_group, name, creator, member_ids}, _from, state) do
    id = Conversations.new_id()
    now = System.system_time(:millisecond)
    conversation = %{id: id, type: :group, name: name, created_by: creator, created_at: now}
    :ets.insert(@conversations, {id, conversation})

    for user_id <- Enum.uniq([creator | member_ids]) do
      role = if user_id == creator, do: :admin, else: :member
      insert_membership(id, user_id, role, now)
    end

    {:reply, {:ok, conversation}, state}
  end

  def handle_call({:create_dm, id, user_a, user_b}, _from, state) do
    case :ets.lookup(@conversations, id) do
      [{^id, conversation}] ->
        {:reply, {:ok, conversation}, state}

      [] ->
        now = System.system_time(:millisecond)
        conversation = %{id: id, type: :dm, name: nil, created_by: user_a, created_at: now}
        :ets.insert(@conversations, {id, conversation})
        insert_membership(id, user_a, :member, now)
        insert_membership(id, user_b, :member, now)
        {:reply, {:ok, conversation}, state}
    end
  end

  def handle_call({:add_member, conversation_id, user_id}, _from, state) do
    reply =
      case :ets.lookup(@conversations, conversation_id) do
        [{^conversation_id, _conversation}] ->
          insert_membership(conversation_id, user_id, :member, System.system_time(:millisecond))
          :ok

        [] ->
          {:error, :not_found}
      end

    {:reply, reply, state}
  end

  defp insert_membership(conversation_id, user_id, role, now) do
    if not :ets.member(@memberships, {conversation_id, user_id}) do
      member = %{
        conversation_id: conversation_id,
        user_id: user_id,
        role: role,
        joined_at: now,
        last_delivered_id: nil,
        last_read_id: nil
      }

      :ets.insert(@memberships, {{conversation_id, user_id}, member})
    end
  end
end
