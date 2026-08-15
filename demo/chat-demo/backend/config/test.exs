import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :wavelink, WavelinkWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "lIe1G1yPqa+X9YBHUJlt5Y8KNyJlp43RjV70gXM0cFOwxkcDlPVLIkH3CinqzwWt",
  server: false

config :wavelink, :store, Wavelink.Store.Memory
config :wavelink, :directory, Wavelink.Directory.Memory
config :wavelink, :conversations, Wavelink.Conversations.Memory

config :wavelink, :media_service_url, "http://localhost:8081"
config :wavelink, :media_service_token, "dev-only-insecure-token"

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
