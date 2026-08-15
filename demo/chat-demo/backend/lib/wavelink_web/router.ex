defmodule WavelinkWeb.Router do
  use WavelinkWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :authed do
    plug WavelinkWeb.Plugs.RequireUserId
  end

  scope "/", WavelinkWeb do
    pipe_through :api

    get "/healthz", HealthController, :show
    post "/api/register", RegistrationController, :create
  end

  scope "/api/conversations", WavelinkWeb do
    pipe_through [:api, :authed]

    post "/", ConversationController, :create
    post "/:id/members", ConversationController, :add_member
    delete "/:id/members/:user_id", ConversationController, :remove_member
  end
end
