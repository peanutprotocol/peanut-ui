export function parseBoundedNumber(value: string, min: number, max: number): number | null {
    if (value.trim() === '') return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.min(max, Math.max(min, parsed))
}
