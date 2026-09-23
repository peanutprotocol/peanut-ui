import type { KeyboardEvent } from 'react'
import { HAND_NARROW, HAND_WIDE } from './avatar.utils'

export const AVATAR_PICKER_COLUMNS = 2

/** From this viewport width (390px at a 16px root) the picker is a 2x3 screen; below it a 2x2
 *  (TASK-22677). The same literal as the `xs` breakpoint token in src/styles/globals.css: a
 *  media-query rem follows the browser's default font size, so a px query here would switch
 *  at a different width from the CSS for anyone who changed that default. */
export const HAND_WIDE_MIN = '24.375rem'

/** Stickers to deal for the current viewport. No matchMedia (jsdom) reads as narrow. */
export const handSize = (): number =>
    typeof window !== 'undefined' && window.matchMedia?.(`(min-width: ${HAND_WIDE_MIN})`)?.matches
        ? HAND_WIDE
        : HAND_NARROW

/**
 * One tab stop per radiogroup; arrows move between tiles and wrap. Left and
 * right walk the whole hand; up and down stay in their column and wrap within
 * it, so a hand whose size is not a multiple of the column count (three tiles
 * in two columns) never drifts sideways.
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
