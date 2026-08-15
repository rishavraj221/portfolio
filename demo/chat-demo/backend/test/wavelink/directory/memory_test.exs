defmodule Wavelink.Directory.MemoryTest do
  use ExUnit.Case, async: true

  alias Wavelink.Directory

  defp username, do: "user-#{System.unique_integer([:positive])}"

  test "registering a new username succeeds" do
    assert :ok = Directory.register(username())
  end

  test "registering the same username twice fails the second time" do
    name = username()
    assert :ok = Directory.register(name)
    assert {:error, :taken} = Directory.register(name)
  end

  test "list includes registered usernames" do
    name = username()
    Directory.register(name)
    assert name in Directory.list()
  end
end
