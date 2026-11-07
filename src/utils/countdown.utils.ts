/** "9:05" for the time left, or null once it has run out. */
export function countdownLabel(remainingMs: number): string | null {
    if (!(remainingMs > 0)) return null
    const minutes = Math.floor(remainingMs / 60_000)
    const seconds = Math.floor((remainingMs % 60_000) / 1000)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}
