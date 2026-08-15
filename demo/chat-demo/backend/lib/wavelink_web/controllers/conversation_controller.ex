defmodule WavelinkWeb.ConversationController do
  use WavelinkWeb, :controller

  alias Wavelink.Conversations

  # Group creation and membership changes are REST, not channel messages —
  # unlike sending a message, these don't need to happen over an already-
  # open socket, and modeling them as a resource (POST/DELETE on
  # /api/conversations/:id/members) keeps them consistent with
  # RegistrationController rather than growing ConversationChannel's
  # handle_in clauses for things that aren't message delivery.
  def create(conn, %{"name" => name, "member_ids" => member_ids}) when is_list(member_ids) do
    creator = conn.assigns.user_id
    name = String.trim(name)

    cond do
      name == "" ->
        conn |> put_status(422) |> json(%{error: "group name can't be blank"})

      member_ids == [] ->
        conn |> put_status(422) |> json(%{error: "a group needs at least one other member"})

      true ->
        {:ok, conversation} = Conversations.create_group(name, creator, member_ids)
        members = Conversations.members(conversation.id)
        payload = encode(conversation, members)

        # Everyone but the creator only finds out about this new group
        # through their inbox topic — the creator already has the response
        # below, and will pick it up again next time their inbox re-lists.
        for member <- members, member.user_id != creator do
          WavelinkWeb.Endpoint.broadcast!(
            "user:#{member.user_id}",
            "conversation_created",
            payload
          )
        end

        conn |> put_status(201) |> json(payload)
    end
  end

  def create(conn, _params) do
    conn |> put_status(422) |> json(%{error: "name and member_ids are required"})
  end

  def add_member(conn, %{"id" => id, "user_id" => new_member}) do
    actor = conn.assigns.user_id

    if Conversations.member?(id, actor) do
      case Conversations.add_member(id, new_member) do
        :ok ->
          {:ok, conversation} = Conversations.get(id)
          members = Conversations.members(id)
          payload = encode(conversation, members)

          WavelinkWeb.Endpoint.broadcast!("user:#{new_member}", "conversation_created", payload)

          WavelinkWeb.Endpoint.broadcast!("conversation:#{id}", "member_added", %{
            conversation_id: id,
            user_id: new_member
          })

          conn |> put_status(200) |> json(payload)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "conversation not found"})
      end
    else
      conn |> put_status(403) |> json(%{error: "only a member can add members"})
    end
  end

  def remove_member(conn, %{"id" => id, "user_id" => target}) do
    actor = conn.assigns.user_id

    if Conversations.member?(id, actor) do
      case Conversations.remove_member(id, target) do
        :ok ->
          WavelinkWeb.Endpoint.broadcast!("conversation:#{id}", "member_removed", %{
            conversation_id: id,
            user_id: target
          })

          conn |> put_status(200) |> json(%{ok: true})

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "not found"})
      end
    else
      conn |> put_status(403) |> json(%{error: "only a member can remove members"})
    end
  end

  defp encode(conversation, members) do
    %{
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      member_ids: Enum.map(members, & &1.user_id)
    }
  end
end
