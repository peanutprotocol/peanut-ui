/**
 * The px box a Tailwind class string draws: `size-N`, or a square `h-N w-N`.
 * Null when the classes set no square box. For the avatar-size suites
 * (TASK-24388), which check the box every slot branch really draws.
 */
export function squareBoxPx(el: Element): number | null {
    const cls = el.className.toString()
    const size = cls.match(/(?:^|\s)size-(\d+)(?:\s|$)/)
    if (size) return Number(size[1]) * 4
    const h = cls.match(/(?:^|\s)h-(\d+)(?:\s|$)/)
    const w = cls.match(/(?:^|\s)w-(\d+)(?:\s|$)/)
    return h && w && h[1] === w[1] ? Number(h[1]) * 4 : null
}

/**
 * The box of the first element under `root` that draws a square box, in
 * document order. A card or header puts its avatar slot before its text, so
 * this is the slot.
 */
export function firstSquareBoxPx(root: Element): number | null {
    for (const el of Array.from(root.querySelectorAll('*'))) {
        const px = squareBoxPx(el)
        if (px !== null) return px
    }
    return null
}
