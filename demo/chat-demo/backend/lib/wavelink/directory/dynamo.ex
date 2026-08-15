defmodule Wavelink.Directory.Dynamo do
  @moduledoc """
  Real backing store: one DynamoDB table, partition key `username`. A
  conditional put (fails if the key already exists) is what makes
  registration a real uniqueness check instead of a check-then-write race.
  """
  @behaviour Wavelink.Directory

  alias ExAws.Dynamo

  defp table, do: Application.fetch_env!(:wavelink, :dynamo_users_table)

  @impl Wavelink.Directory
  def register(username) do
    table()
    |> Dynamo.put_item(%{"username" => username},
      condition_expression: "attribute_not_exists(username)"
    )
    |> ExAws.request()
    |> case do
      {:ok, _} -> :ok
      {:error, {"ConditionalCheckFailedException", _}} -> {:error, :taken}
    end
  end

  @impl Wavelink.Directory
  def list do
    table()
    |> Dynamo.scan()
    |> ExAws.request!()
    |> Map.get("Items")
    |> Enum.map(&Dynamo.decode_item/1)
    |> Enum.map(& &1["username"])
    |> Enum.sort()
  end
end
