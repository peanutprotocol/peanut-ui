import { twMerge } from '@/utils/tw'
import type { DrawnQrCodeProps } from './drawnQrCode.types'

/**
 * The 29×29 code the Peanut scanner reads in manteca_ss.webp, module for
 * module, so a till sticker beside that capture shows the same QR. Both
 * format-information strips are blanked, so the drawn copy does not scan.
 */
const ROWS = [
    '#######..#.#...##..##.#######',
    '#.....#..##..#.#..#.#.#.....#',
    '#.###.#...#..#..##.##.#.###.#',
    '#.###.#......###.#....#.###.#',
    '#.###.#....#.##.#.#...#.###.#',
    '#.....#..#..#.#.###...#.....#',
    '#######.#.#.#.#.#.#.#.#######',
    '.........#..####.#.##........',
    '......#..##..##.##..#........',
    '.##.##..###.#.#..#..#.##.#.##',
    '...#..#.###.....#...#..#..#.#',
    '#......##.#....#...#######...',
    '#######.###.....#...####.#.#.',
    '##.###.#.##...#.#.##..#..#..#',
    '......#......#...####..#.##.#',
    '...###..##.#.##...#####.##...',
    '##....#..#.#.######.#.##...##',
    '#.#.#..#..####..#.#..##..#..#',
    '..#####.##.####.#..#....###.#',
    '###..#.#.####.###.#####..#.#.',
    '..#.#####.#.##..#..#######.#.',
    '........##....####..#...##.##',
    '#######...######....#.#.###.#',
    '#.....#..##..#.#.#.##...##.#.',
    '#.###.#..###.##..#.######..#.',
    '#.###.#..#...##..#.#.#.##.##.',
    '#.###.#.....####.##.##.##.###',
    '#.....#..#..#.#...#.#....#...',
    '#######..####..##...##.###..#',
]

const MODULES_PATH = ROWS.flatMap((row, y) =>
    [...row].map((cell, x) => (cell === '#' ? `M${x} ${y}h1v1h-1z` : ''))
).join('')

/** A drawn, unscannable QR for the QR-payment pages' till stickers. */
export function DrawnQrCode({ className }: DrawnQrCodeProps) {
    return (
        <svg
            viewBox={`0 0 ${ROWS.length} ${ROWS.length}`}
            className={twMerge('block aspect-square text-foreground-primary', className)}
            shapeRendering="crispEdges"
            aria-hidden
        >
            <path d={MODULES_PATH} fill="currentColor" />
        </svg>
    )
}
