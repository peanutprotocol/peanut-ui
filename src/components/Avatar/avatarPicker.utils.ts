import type { KeyboardEvent } from 'react'

export const AVATAR_PICKER_COLUMNS = 3

/**
 * One tab stop per radiogroup; arrows move between tiles and wrap. Left and
 * right walk the whole hand; up and down stay in their column and wrap within
 * it, so a hand whose size is not a multiple of the column count (eight tiles
 * in three columns) never drifts sideways.
 */
export function roveAvatarTiles(event: KeyboardEvent<HTMLDivElement>): void {
    const step = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: AVATAR_PICKER_COLUMNS,
        ArrowUp: -AVATAR_PICKER_COLUMNS,
    }[event.key]
    if (!step) return
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const index = radios.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    radios[nextTileIndex(index, step, radios.length)].focus()
}

/** The index an arrow lands on from `index`, for a grid of AVATAR_PICKER_COLUMNS columns. */
export function nextTileIndex(index: number, step: number, count: number): number {
    const cols = AVATAR_PICKER_COLUMNS
    const next = index + step
    if (Math.abs(step) === 1) return (next + count) % count
    if (next >= count) return index % cols
    if (next < 0) return index + cols * Math.floor((count - 1 - index) / cols)
    return next
}
