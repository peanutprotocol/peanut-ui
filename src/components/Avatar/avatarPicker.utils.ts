import type { KeyboardEvent } from 'react'

export const AVATAR_PICKER_COLUMNS = 5

/** One tab stop per radiogroup; arrows move between tiles and wrap. */
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
    radios[(index + step + radios.length) % radios.length].focus()
}
