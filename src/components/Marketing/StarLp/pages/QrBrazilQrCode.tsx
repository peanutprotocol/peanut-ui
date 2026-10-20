import { twMerge } from '@/utils/tw'
import type { QrBrazilQrCodeProps } from './qrBrazil.types'

const SIZE = 25

/** Finder squares sit in three corners, as on a real QR. */
const FINDERS: Array<[number, number]> = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
]

function inFinderZone(x: number, y: number) {
    return FINDERS.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)
}

/** A fixed pseudo-random module pattern, so server and client draw the same code. */
function buildModulesPath() {
    let seed = 0x5eed
    const next = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
    }
    let d = ''
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (inFinderZone(x, y)) continue
            const timing = (x === 6 || y === 6) && (x + y) % 2 === 0
            if (timing || next() > 0.52) d += `M${x} ${y}h1v1h-1z`
        }
    }
    for (const [fx, fy] of FINDERS) {
        d += `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5z`
        d += `M${fx + 2} ${fy + 2}h3v3h-3z`
    }
    return d
}

const MODULES_PATH = buildModulesPath()

/** A drawn, unscannable QR code: it reads as a QR and leads nowhere. */
export function QrBrazilQrCode({ className }: QrBrazilQrCodeProps) {
    return (
        <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className={twMerge('block aspect-square text-foreground-primary', className)}
            shapeRendering="crispEdges"
            aria-hidden
        >
            <path d={MODULES_PATH} fill="currentColor" fillRule="evenodd" />
        </svg>
    )
}
