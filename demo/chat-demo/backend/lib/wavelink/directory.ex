defmodule Wavelink.Directory do
  @moduledoc """
  The registered-user directory — separate from `Wavelink.Store`, which only
  ever holds messages. Registering just claims a username, there's no
  password: this is a demo of the messaging system, not an auth system.
  Same swappable-implementation pattern as `Store` (Memory for dev/test,
  Dynamo for prod), see config/runtime.exs.
  """

  @callback register(username :: String.t()) :: :ok | {:error, :taken}
  @callback list() :: [String.t()]

  def impl, do: Application.get_env(:wavelink, :directory, Wavelink.Directory.Memory)

  def register(username), do: impl().register(username)
  def list, do: impl().list()
end
