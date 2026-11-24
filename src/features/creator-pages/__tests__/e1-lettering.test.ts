import { NITA_E1_LETTERING } from '../pages/juanacervio/nita-e1.copy'
import { E1_LETTERING_CAP_HEIGHT, E1_LETTERING_OUTLINES } from '../pages/juanacervio/e1/lettering-outlines'

/**
 * The area inside an SVG path, for the commands the outline generator writes (M, L, H, V, Q, T, Z,
 * absolute or relative). Counters are wound the other way, so they subtract themselves.
 */
function inkArea(d: string): number {
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? []
    let area = 0
    let [x, y, startX, startY] = [0, 0, 0, 0]
    let control: [number, number] | null = null
    let command = ''
    let index = 0
    const next = () => Number(tokens[index++])
    const lineTo = (toX: number, toY: number) => {
        area += (x * toY - toX * y) / 2
        ;[x, y, control] = [toX, toY, null]
    }
    const curveTo = (cx: number, cy: number, toX: number, toY: number) => {
        area += (2 * (x * cy - cx * y) + 2 * (cx * toY - toX * cy) + (x * toY - toX * y)) / 6
        ;[x, y, control] = [toX, toY, [cx, cy]]
    }
    while (index < tokens.length) {
        if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++]
        const relative = command === command.toLowerCase()
        const [baseX, baseY] = relative ? [x, y] : [0, 0]
        switch (command.toUpperCase()) {
            case 'M':
                ;[x, y] = [baseX + next(), baseY + next()]
                ;[startX, startY, control] = [x, y, null]
                break
            case 'L':
                lineTo(baseX + next(), baseY + next())
                break
            case 'H':
                lineTo(baseX + next(), y)
                break
            case 'V':
                lineTo(x, baseY + next())
                break
            case 'Q':
                curveTo(baseX + next(), baseY + next(), baseX + next(), baseY + next())
                break
            case 'T': {
                const [cx, cy] = control ? [2 * x - control[0], 2 * y - control[1]] : [x, y]
                curveTo(cx, cy, baseX + next(), baseY + next())
                break
            }
            case 'Z':
                lineTo(startX, startY)
                break
            default:
                throw new Error(`Unexpected path command ${command}`)
        }
    }
    return Math.abs(area)
}

describe('E1 headline lettering', () => {
    it('has a drawing for every headline line in the copy, and no stale ones', () => {
        expect(Object.keys(E1_LETTERING_OUTLINES).sort()).toEqual([...NITA_E1_LETTERING].sort())
    })

    // The first drawings were Roboto Flex at its default weight 400 while their header said 1000: the
    // generator's font library ignored the weight on a WOFF2. Ink is the measure that tells the two
    // apart for any text. At weight 1000 the letters fill 55 to 60% of the box "line width × cap
    // height"; the weight-400 drawings of the same three lines filled 30 to 34%.
    it.each(Object.entries(E1_LETTERING_OUTLINES))('%s is drawn at the heavy weight', (_line, { advance, d }) => {
        const ink = inkArea(d) / (advance * E1_LETTERING_CAP_HEIGHT)
        expect(ink).toBeGreaterThan(0.5)
        expect(ink).toBeLessThan(0.68)
    })
})
