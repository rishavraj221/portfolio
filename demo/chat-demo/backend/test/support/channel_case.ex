defmodule WavelinkWeb.ChannelCase do
  @moduledoc """
  Test case for channel tests, wraps `Phoenix.ChannelTest`. There's no
  database here (see `Wavelink.Store.Memory`), so unlike a typical
  Phoenix-generated case there's no sandbox setup — each test just clears
  the ETS table it needs.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import WavelinkWeb.ChannelCase

      @endpoint WavelinkWeb.Endpoint
    end
  end
end
