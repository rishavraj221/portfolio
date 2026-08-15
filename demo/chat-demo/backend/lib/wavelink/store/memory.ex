defmodule Wavelink.Store.Memory do
  @moduledoc """
  In-memory stand-in for DynamoDB, same partition/sort shape (conversation,
  message id). Used in dev and test so the whole message/replay flow can be
  built and verified without any AWS credentials. One ETS table, owned by a
  GenServer so writes are serialized per node — fine for a demo's traffic,
  not a claim about production concurrency.
  """
  @behaviour Wavelink.Store

  use GenServer

  @table :wavelink_messages

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl GenServer
  def init(:ok) do
    :ets.new(@table, [:ordered_set, :named_table, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl Wavelink.Store
  def put_message(conversation_id, from, body) do
    id = Wavelink.Store.new_id()

    message = %{
      id: id,
      conversation_id: conversation_id,
      from: from,
      body: body,
      inserted_at: System.system_time(:millisecond)
    }

    :ets.insert(@table, {{conversation_id, id}, message})
    {:ok, message}
  end

  @impl Wavelink.Store
  def list_since(conversation_id, since_id) do
    :ets.match_object(@table, {{conversation_id, :_}, :_})
    |> Enum.map(fn {_key, message} -> message end)
    |> Enum.filter(fn message -> since_id == nil or message.id > since_id end)
    |> Enum.sort_by(& &1.id)
  end
end
