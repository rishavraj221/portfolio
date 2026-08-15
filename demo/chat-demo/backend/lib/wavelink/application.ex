defmodule Wavelink.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        WavelinkWeb.Telemetry,
        {DNSCluster, query: Application.get_env(:wavelink, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Wavelink.PubSub},
        WavelinkWeb.Presence
      ] ++
        store_children() ++
        directory_children() ++
        conversations_children() ++
        [
          # Start to serve requests, typically the last entry
          WavelinkWeb.Endpoint
        ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Wavelink.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    WavelinkWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp store_children do
    if Wavelink.Store.impl() == Wavelink.Store.Memory do
      [Wavelink.Store.Memory]
    else
      []
    end
  end

  defp directory_children do
    if Wavelink.Directory.impl() == Wavelink.Directory.Memory do
      [Wavelink.Directory.Memory]
    else
      []
    end
  end

  defp conversations_children do
    if Wavelink.Conversations.impl() == Wavelink.Conversations.Memory do
      [Wavelink.Conversations.Memory]
    else
      []
    end
  end
end
