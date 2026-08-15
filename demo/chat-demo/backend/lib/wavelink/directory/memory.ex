defmodule Wavelink.Directory.Memory do
  @moduledoc """
  In-memory registered-username set, same role `Wavelink.Store.Memory`
  plays for messages: no AWS credentials needed for dev/test.
  """
  @behaviour Wavelink.Directory

  use GenServer

  @table :wavelink_users

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl GenServer
  def init(:ok) do
    :ets.new(@table, [:set, :named_table, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl Wavelink.Directory
  def register(username) do
    if :ets.insert_new(@table, {username}) do
      :ok
    else
      {:error, :taken}
    end
  end

  @impl Wavelink.Directory
  def list do
    :ets.tab2list(@table)
    |> Enum.map(fn {username} -> username end)
    |> Enum.sort()
  end
end
