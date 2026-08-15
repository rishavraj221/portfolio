defmodule WavelinkWeb.RegistrationController do
  use WavelinkWeb, :controller

  alias Wavelink.Directory

  # Claiming a username is the entire "auth" story here — no password, this
  # is a demo of the messaging system, not an identity system. Uniqueness
  # is enforced by the store (atomic insert / conditional put), not by a
  # check-then-write here, so two people racing for the same name can't
  # both win.
  #
  # Because there's no password, "this name is already registered" and
  # "this is you, reconnecting after closing the tab" are indistinguishable
  # — the client has nothing else to prove who it is. So an existing
  # username resumes rather than rejects: your messages and identity live
  # in Store/Directory regardless of any browser tab, the registration
  # step was only ever a one-time gate on the *name*, not a login.
  def create(conn, %{"username" => username}) do
    username = String.trim(username)

    cond do
      username == "" ->
        conn |> put_status(422) |> json(%{error: "username can't be blank"})

      byte_size(username) > 32 ->
        conn |> put_status(422) |> json(%{error: "username is too long"})

      true ->
        case Directory.register(username) do
          :ok ->
            # Everyone already sitting on the lobby topic only got the
            # registered-users list as of their own join — without this,
            # a user who registered after them would be invisible in
            # "new chat" until they happened to reconnect.
            WavelinkWeb.Endpoint.broadcast!("directory:lobby", "user_registered", %{
              username: username
            })

            conn |> put_status(201) |> json(%{username: username})

          {:error, :taken} ->
            # Not an error the client needs to react to — just means this
            # was a resume, not a fresh claim. See the moduledoc-style note
            # above for why "taken" isn't actually rejectable here.
            conn |> put_status(200) |> json(%{username: username})
        end
    end
  end

  def create(conn, _params) do
    conn |> put_status(422) |> json(%{error: "username is required"})
  end
end
