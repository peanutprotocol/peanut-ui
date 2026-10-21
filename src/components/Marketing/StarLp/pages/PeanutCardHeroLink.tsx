'use client'

import Link from 'next/link'
import { PeanutCardHeroFace } from './PeanutCardHeroFace'
import { usePeanutCardCta } from './usePeanutCardCta'

/**
 * The hero card as a pointer-only twin of the hero CTA (peanut.me's
 * ShhhhhFold links the same face to /shhhhh): same destination, same store
 * handoff, its own `placement`. It sits in the hero's aria-hidden art, so it
 * leaves the tab order; keyboards use the real CTA. A press pushes the face
 * onto its shadow; hover adds no motion (design.md § marketing components).
 */
export function PeanutCardHeroLink() {
    const { href, onClick, storeHandoffModal } = usePeanutCardCta('hero-card')

    return (
        <>
            <Link href={href} prefetch={false} tabIndex={-1} onClick={onClick} className="group/card block select-none">
                <PeanutCardHeroFace pressable />
            </Link>
            {storeHandoffModal}
        </>
    )
}
