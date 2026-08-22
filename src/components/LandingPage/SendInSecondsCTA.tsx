'use client'

import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'

export function SendInSecondsCTA({ strings }: { strings: LandingStrings }) {
    return (
        <div className="relative mt-12 inline-block md:mt-24">
            {/* `.cta-motion` / `.cta-enter` in globals.css — same entrance and
                hover as the framer-motion pair this replaces, on the compositor. */}
            <div className="cta-motion cta-enter relative">
                <Link prefetch={false} href="/send">
                    <Button
                        shadowSize="4"
                        className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    >
                        {strings.sendNow}
                    </Button>
                </Link>
            </div>
        </div>
    )
}
