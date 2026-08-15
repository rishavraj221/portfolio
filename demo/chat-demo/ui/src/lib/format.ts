// inserted_at has been on every ChatMessage since the start — this was
// just never rendered anywhere in the UI.
export function formatTime(insertedAt: number): string {
  return new Date(insertedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
