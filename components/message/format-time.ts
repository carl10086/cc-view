export function formatTime(timestamp: Date | string): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
