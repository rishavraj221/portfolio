defmodule Wavelink.Conversations.Dynamo do
  @moduledoc """
  Real backing store: two DynamoDB tables.

  `conversations` — partition key `id`.

  `memberships` — partition key `conversation_id`, sort key `user_id`, plus
  a global secondary index (`by_user`, partition key `user_id`) so
  `list_for_user/1` is one query instead of a table scan — the same reason
  `Wavelink.Directory.Dynamo.list/0` gets away with a scan (small table) and
  this one deliberately doesn't (memberships grow with every group anyone
  joins).

  Table and index names come from config so the same code runs against
  whatever `demo/chat-demo/infra/modules/core` and `modules/groups`
  provision.
  """
  @behaviour Wavelink.Conversations

  alias ExAws.Dynamo
  alias Wavelink.Conversations

  defp conversations_table, do: Application.fetch_env!(:wavelink, :dynamo_conversations_table)
  defp memberships_table, do: Application.fetch_env!(:wavelink, :dynamo_memberships_table)

  defp by_user_index,
    do: Application.get_env(:wavelink, :dynamo_memberships_by_user_index, "by_user")

  @impl Wavelink.Conversations
  def create_group(name, creator, member_ids) do
    id = Conversations.new_id()
    now = System.system_time(:millisecond)
    conversation = %{id: id, type: :group, name: name, created_by: creator, created_at: now}

    {:ok, _} =
      conversations_table()
      |> Dynamo.put_item(conversation_item(conversation))
      |> ExAws.request()

    for user_id <- Enum.uniq([creator | member_ids]) do
      role = if user_id == creator, do: :admin, else: :member
      put_membership(id, user_id, role, now)
    end

    {:ok, conversation}
  end

  @impl Wavelink.Conversations
  def get_or_create_dm(user_a, user_b) do
    id = Conversations.dm_id(user_a, user_b)

    case get(id) do
      {:ok, conversation} ->
        {:ok, conversation}

      {:error, :not_found} ->
        now = System.system_time(:millisecond)
        conversation = %{id: id, type: :dm, name: nil, created_by: user_a, created_at: now}

        # Conditional put, same reasoning as Directory.Dynamo.register/1 —
        # two clients racing to open the same DM for the first time should
        # both land on one conversation, not one each.
        case conversations_table()
             |> Dynamo.put_item(conversation_item(conversation),
               condition_expression: "attribute_not_exists(id)"
             )
             |> ExAws.request() do
          {:ok, _} ->
            put_membership(id, user_a, :member, now)
            put_membership(id, user_b, :member, now)
            {:ok, conversation}

          {:error, {"ConditionalCheckFailedException", _}} ->
            get(id)
        end
    end
  end

  @impl Wavelink.Conversations
  def get(conversation_id) do
    conversations_table()
    |> Dynamo.get_item(%{"id" => conversation_id})
    |> ExAws.request!()
    |> case do
      %{"Item" => item} when map_size(item) > 0 ->
        {:ok, item |> Dynamo.decode_item() |> from_conversation_item()}

      _ ->
        {:error, :not_found}
    end
  end

  @impl Wavelink.Conversations
  def add_member(conversation_id, user_id) do
    case get(conversation_id) do
      {:ok, _conversation} ->
        put_membership(conversation_id, user_id, :member, System.system_time(:millisecond))
        :ok

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @impl Wavelink.Conversations
  def remove_member(conversation_id, user_id) do
    memberships_table()
    |> Dynamo.delete_item(%{"conversation_id" => conversation_id, "user_id" => user_id})
    |> ExAws.request()
    |> case do
      {:ok, _} -> :ok
      {:error, _} -> {:error, :not_found}
    end
  end

  @impl Wavelink.Conversations
  def members(conversation_id) do
    memberships_table()
    |> Dynamo.query(
      key_condition_expression: "conversation_id = :cid",
      expression_attribute_values: %{":cid" => conversation_id}
    )
    |> ExAws.request!()
    |> Map.get("Items")
    |> Enum.map(&Dynamo.decode_item/1)
    |> Enum.map(&from_membership_item/1)
    |> Enum.sort_by(& &1.joined_at)
  end

  @impl Wavelink.Conversations
  def member?(conversation_id, user_id) do
    memberships_table()
    |> Dynamo.get_item(%{"conversation_id" => conversation_id, "user_id" => user_id})
    |> ExAws.request!()
    |> case do
      %{"Item" => item} -> map_size(item) > 0
      _ -> false
    end
  end

  @impl Wavelink.Conversations
  def list_for_user(user_id) do
    memberships_table()
    |> Dynamo.query(
      index_name: by_user_index(),
      key_condition_expression: "user_id = :uid",
      expression_attribute_values: %{":uid" => user_id}
    )
    |> ExAws.request!()
    |> Map.get("Items")
    |> Enum.map(&Dynamo.decode_item/1)
    |> Enum.map(&from_membership_item/1)
    |> Enum.map(fn member -> get(member.conversation_id) end)
    |> Enum.flat_map(fn
      {:ok, conversation} -> [conversation]
      {:error, :not_found} -> []
    end)
    |> Enum.sort_by(& &1.created_at, :desc)
  end

  @impl Wavelink.Conversations
  def mark_delivered(conversation_id, user_id, message_id) do
    bump_cursor(conversation_id, user_id, "last_delivered_id", message_id)
  end

  @impl Wavelink.Conversations
  def mark_read(conversation_id, user_id, message_id) do
    bump_cursor(conversation_id, user_id, "last_read_id", message_id)
  end

  defp bump_cursor(conversation_id, user_id, field, message_id) do
    memberships_table()
    |> Dynamo.update_item(
      %{"conversation_id" => conversation_id, "user_id" => user_id},
      update_expression: "SET #f = :new",
      condition_expression:
        "attribute_exists(conversation_id) AND (attribute_not_exists(#f) OR #f < :new)",
      expression_attribute_names: %{"#f" => field},
      expression_attribute_values: %{":new" => message_id}
    )
    |> ExAws.request()

    :ok
  end

  defp put_membership(conversation_id, user_id, role, now) do
    item = %{
      "conversation_id" => conversation_id,
      "user_id" => user_id,
      "role" => Atom.to_string(role),
      "joined_at" => now,
      "last_delivered_id" => nil,
      "last_read_id" => nil
    }

    memberships_table()
    |> Dynamo.put_item(item, condition_expression: "attribute_not_exists(conversation_id)")
    |> ExAws.request()
  end

  defp conversation_item(conversation) do
    %{
      "id" => conversation.id,
      "type" => Atom.to_string(conversation.type),
      "name" => conversation.name,
      "created_by" => conversation.created_by,
      "created_at" => conversation.created_at
    }
  end

  # to_atom/1, not to_existing_atom/1 — same argument as Store.Dynamo.from_item/1:
  # these fields only ever hold values this same codebase wrote.
  defp from_conversation_item(item) do
    %{
      id: item["id"],
      type: String.to_atom(item["type"]),
      name: item["name"],
      created_by: item["created_by"],
      created_at: item["created_at"]
    }
  end

  defp from_membership_item(item) do
    %{
      conversation_id: item["conversation_id"],
      user_id: item["user_id"],
      role: String.to_atom(item["role"]),
      joined_at: item["joined_at"],
      last_delivered_id: item["last_delivered_id"],
      last_read_id: item["last_read_id"]
    }
  end
end
