'use client'

import Image from 'next/image'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'

export type StarSpec = { left: number; top: number; size: number; sparkle?: boolean }

/**
 * The mock's `stars()`: approved star and sparkle doodles in the art box. They pop in once after the main art and
 * hold still; small phones drop them (mock data-sm="hide").
 */
export function StarDoodles({ stars, order = 0 }: { stars: readonly StarSpec[]; order?: number }) {
    return (
        <>
            {stars.map((spec, index) => (
                <ArtPiece
                    key={`${spec.left}-${spec.top}`}
                    left={spec.left}
                    top={spec.top}
                    width={spec.size}
                    height={spec.size}
                    rotate={spec.sparkle ? -20 : 0}
                    entrance="pop"
                    order={order + index}
                    zIndex={7}
                    smHide
                >
                    <Image src={spec.sparkle ? sparkle : star} alt="" fill className="object-contain" />
                </ArtPiece>
            ))}
        </>
    )
}
