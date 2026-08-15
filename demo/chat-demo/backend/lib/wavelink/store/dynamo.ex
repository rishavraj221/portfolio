defmodule Wavelink.Store.Dynamo do
  @moduledoc """
  Real backing store: one DynamoDB table, partition key `conversation_id`
  (string), sort key `id` (string, see `Wavelink.Store.new_id/0` for why it
  sorts correctly without a global clock). Table name comes from config so
  the same code runs against whatever `demo/chat-demo/infra/modules/core`
  provisions.
  """
  @behaviour Wavelink.Store

  alias ExAws.Dynamo

  defp table, do: Application.fetch_env!(:wavelink, :dynamo_table)

  @impl Wavelink.Store
  def put_message(conversation_id, from, body) do
    id = Wavelink.Store.new_id()

    message = %{
      "conversation_id" => conversation_id,
      "id" => id,
      "from" => from,
      "body" => body,
      "inserted_at" => System.system_time(:millisecond)
    }

    {:ok, _} = table() |> Dynamo.put_item(message) |> ExAws.request()
    {:ok, from_item(message)}
  end

  @impl Wavelink.Store
  def list_since(conversation_id, since_id) do
    {key_condition, values} =
      if since_id do
        {"conversation_id = :c AND id > :since", %{":c" => conversation_id, ":since" => since_id}}
      else
        {"conversation_id = :c", %{":c" => conversation_id}}
      end

    table()
    |> Dynamo.query(
      key_condition_expression: key_condition,
      expression_attribute_values: values
    )
    |> ExAws.request!()
    |> Map.get("Items")
    |> Enum.map(&Dynamo.decode_item/1)
    |> Enum.map(&from_item/1)
    |> Enum.sort_by(& &1.id)
  end

  defp from_item(item) do
    %{
      id: item["id"],
      conversation_id: item["conversation_id"],
      from: item["from"],
      body: item["body"],
      inserted_at: item["inserted_at"]
    }
  end
end
