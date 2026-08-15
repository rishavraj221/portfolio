import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/wavelink start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :wavelink, WavelinkWeb.Endpoint, server: true
end

config :wavelink, WavelinkWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

if config_env() == :prod do
  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :wavelink, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  # Real store — demo/chat-demo/infra/modules/core provisions the table and
  # passes its name down as DYNAMO_MESSAGES_TABLE.
  config :wavelink, :store, Wavelink.Store.Dynamo

  config :wavelink,
         :dynamo_table,
         System.get_env("DYNAMO_MESSAGES_TABLE") ||
           raise("environment variable DYNAMO_MESSAGES_TABLE is missing")

  config :wavelink, :directory, Wavelink.Directory.Dynamo

  config :wavelink,
         :dynamo_users_table,
         System.get_env("DYNAMO_USERS_TABLE") ||
           raise("environment variable DYNAMO_USERS_TABLE is missing")

  # Real conversations/memberships store — demo/chat-demo/infra/modules/groups
  # provisions these two tables (plus the memberships table's by-user GSI)
  # and passes their names down.
  config :wavelink, :conversations, Wavelink.Conversations.Dynamo

  config :wavelink,
         :dynamo_conversations_table,
         System.get_env("DYNAMO_CONVERSATIONS_TABLE") ||
           raise("environment variable DYNAMO_CONVERSATIONS_TABLE is missing")

  config :wavelink,
         :dynamo_memberships_table,
         System.get_env("DYNAMO_MEMBERSHIPS_TABLE") ||
           raise("environment variable DYNAMO_MEMBERSHIPS_TABLE is missing")

  config :wavelink,
         :dynamo_memberships_by_user_index,
         System.get_env("DYNAMO_MEMBERSHIPS_BY_USER_INDEX", "by_user")

  config :ex_aws, region: System.get_env("AWS_REGION", "ap-south-1")

  # Comma-separated list, e.g. "https://chat-demo.rishavraj.info".
  config :wavelink,
         :allowed_origins,
         (System.get_env("ALLOWED_ORIGINS") || "")
         |> String.split(",", trim: true)

  # demo/media-service, deployed separately from Wavelink — see its README.
  config :wavelink,
         :media_service_url,
         System.get_env("MEDIA_SERVICE_URL") ||
           raise("environment variable MEDIA_SERVICE_URL is missing")

  config :wavelink,
         :media_service_token,
         System.get_env("MEDIA_SERVICE_TOKEN") ||
           raise("environment variable MEDIA_SERVICE_TOKEN is missing")

  config :wavelink, WavelinkWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://bandit.hexdocs.pm/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :wavelink, WavelinkWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://plug.hexdocs.pm/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :wavelink, WavelinkWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
