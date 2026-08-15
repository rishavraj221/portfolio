defmodule WavelinkWeb.HealthController do
  use WavelinkWeb, :controller

  # The ALB target group health check hits this — see
  # demo/chat-demo/infra/modules/core. No auth, no dependencies checked,
  # just "the BEAM is up and the endpoint is serving."
  def show(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
