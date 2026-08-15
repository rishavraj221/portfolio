defmodule Wavelink.Media do
  @moduledoc """
  Thin client for `media-service`, the standalone Go service under
  `demo/media-service` that owns file storage — it is deliberately not part
  of this app, so that it can be reused by anything else this repo ever
  builds, not just Wavelink. See its README for the full design.

  Wavelink's backend is the only thing that ever calls media-service
  directly: a browser never sees the service token, and `owner_id` is always
  the id this backend already authenticated via `x-user-id`
  (`WavelinkWeb.Plugs.RequireUserId`), never a value trusted from the
  request body. The browser *does* talk to storage directly for the actual
  bytes — media-service hands back a presigned URL for that leg, this
  module never proxies file contents.
  """

  @type media_id :: String.t()

  @doc """
  Requests a presigned upload slot. Returns the record id and the URL the
  caller should `PUT` the file's bytes to directly.
  """
  @spec create_upload(String.t(), String.t(), non_neg_integer()) ::
          {:ok, map()} | {:error, term()}
  def create_upload(owner_id, content_type, size_bytes) do
    request(:post, "/media", %{
      owner_id: owner_id,
      content_type: content_type,
      size_bytes: size_bytes
    })
  end

  @doc """
  Confirms an upload landed. `owner_id` must match who the upload was
  created for — media-service enforces this and returns 403 otherwise, the
  same guard `Wavelink.Directory.register/1`'s conditional write is for
  registration races, just for a different kind of spoofing.
  """
  @spec complete_upload(media_id(), String.t()) :: {:ok, map()} | {:error, term()}
  def complete_upload(id, owner_id) do
    request(:post, "/media/#{id}/complete", %{owner_id: owner_id})
  end

  @doc """
  Resolves a media record, including a short-lived signed URL if it's ready
  or still processing. Deliberately not restricted to the owner — anyone
  Wavelink itself has already decided may see this conversation may see the
  media in it; media-service isn't the layer that knows about conversation
  membership, `WavelinkWeb.ConversationChannel` is.
  """
  @spec get(media_id()) :: {:ok, map()} | {:error, term()}
  def get(id), do: request(:get, "/media/#{id}", nil)

  defp request(method, path, body) do
    base_url = Application.fetch_env!(:wavelink, :media_service_url)
    token = Application.fetch_env!(:wavelink, :media_service_token)

    opts =
      [method: method, url: base_url <> path, auth: {:bearer, token}]
      |> then(fn opts -> if body, do: Keyword.put(opts, :json, body), else: opts end)

    case Req.request(opts) do
      {:ok, %Req.Response{status: status, body: resp_body}} when status in 200..299 ->
        {:ok, resp_body}

      {:ok, %Req.Response{status: status, body: resp_body}} ->
        {:error, {:http_error, status, resp_body}}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
