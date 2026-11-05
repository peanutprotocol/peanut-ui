import type { CSSProperties } from 'react'
import { knerdTitle } from './Title.consts'

/** The tilt (and, on line 2, the small shift right) of one Knerd line; none from line 3. */
export function knerdLineStyle(index: number): CSSProperties | undefined {
    const tilt = knerdTitle.lineTilt[index] ?? 0
    const shift = index === 1 ? knerdTitle.secondLineShift : '0'
    if (!tilt && shift === '0') return undefined
    return { transform: `rotate(${tilt}deg) translateX(${shift})` }
}
