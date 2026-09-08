import type { KeyboardEvent } from 'react'

/** One tab stop per radiogroup; arrows move between tiles and wrap. */
export function roveAvatarTiles(event: KeyboardEvent<HTMLDivElement>, columns: number): void {
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
