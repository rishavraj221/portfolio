defmodule WavelinkWeb.MediaController do
  use WavelinkWeb, :controller

  alias Wavelink.Media

  # Attachments are REST, not a channel message, for the same reason group
  # membership is (see ConversationController): a presigned upload doesn't
  # need an already-open socket, and the browser talks to object storage
  # directly for the actual bytes — this controller only ever proxies the
  # small JSON exchanges around that, never file contents.
  #
  # `show/2` is a known gap, named rather than silently left: it returns any
  # media record to any authenticated Wavelink user, not just members of
  # whatever conversation it was attached to. Media ids are sortable,
  # sequential-looking strings (see media-service's NewID), not secrets, so
  # this is guessable-by-id exposure, the same shape as the "no auth" cut in
  # RegistrationController but for attachments instead of identity. Closing
  # it needs a media_id -> conversation_id index this pass doesn't build —
  # `Wavelink.Store` only records the association the other direction, on
  # the message row.
  def create(conn, %{"content_type" => content_type, "size_bytes" => size_bytes}) do
    owner_id = conn.assigns.user_id

    respond(conn, Media.create_upload(owner_id, content_type, size_bytes), 201)
  end

  def create(conn, _params) do
    conn |> put_status(422) |> json(%{error: "content_type and size_bytes are required"})
  end

  def complete(conn, %{"id" => id}) do
    owner_id = conn.assigns.user_id

    respond(conn, Media.complete_upload(id, owner_id), 200)
  end

  def show(conn, %{"id" => id}) do
    respond(conn, Media.get(id), 200)
  end

  defp respond(conn, {:ok, body}, ok_status), do: conn |> put_status(ok_status) |> json(body)

  defp respond(conn, {:error, {:http_error, status, body}}, _ok_status),
    do: conn |> put_status(status) |> json(body)

  defp respond(conn, {:error, _reason}, _ok_status),
    do: conn |> put_status(502) |> json(%{error: "media service unavailable"})
end
