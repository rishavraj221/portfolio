defmodule Wavelink.Store.MemoryTest do
  use ExUnit.Case, async: true

  alias Wavelink.Store

  defp conversation_id, do: "conv-#{System.unique_integer([:positive])}"

  test "list_since with no cursor returns everything, oldest first" do
    conversation = conversation_id()
    {:ok, m1} = Store.put_message(conversation, "a", "first")
    {:ok, m2} = Store.put_message(conversation, "a", "second")

    assert Store.list_since(conversation, nil) == [m1, m2]
  end

  test "list_since with a cursor only returns messages after it" do
    conversation = conversation_id()
    {:ok, m1} = Store.put_message(conversation, "a", "first")
    {:ok, m2} = Store.put_message(conversation, "a", "second")

    assert Store.list_since(conversation, m1.id) == [m2]
  end

  test "messages from different conversations don't leak into each other" do
    a = conversation_id()
    b = conversation_id()
    {:ok, m1} = Store.put_message(a, "x", "in a")
    Store.put_message(b, "x", "in b")

    assert Store.list_since(a, nil) == [m1]
  end
end
