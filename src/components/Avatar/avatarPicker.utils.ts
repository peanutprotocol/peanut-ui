import type { KeyboardEvent } from 'react'

export const AVATAR_PICKER_COLUMNS = 5
/** The initials group is 26 tiles; 7 across keeps it four rows instead of six. */
export const AVATAR_PICKER_LETTER_COLUMNS = 7

/** One tab stop per radiogroup; arrows move between tiles and wrap. Vertical
 *  steps read the group's own column count off `data-columns`, so the initials
 *  grid roves by its 7 and not by the 5 of the sticker rows. */
export function roveAvatarTiles(event: KeyboardEvent<HTMLDivElement>): void {
    const columns = Number(event.currentTarget.dataset.columns) || AVATAR_PICKER_COLUMNS
    const step = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: columns,
        ArrowUp: -columns,
    }[event.key]
    if (!step) return
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const index = radios.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    radios[(index + step + radios.length) % radios.length].focus()
}
