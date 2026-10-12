'use client'

import { LandingAppLink } from './LandingAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'

export function SendInSecondsCTA({ strings }: { strings: LandingStrings }) {
    return (
        <div className="relative mt-12 inline-block md:mt-24">
            {/* `.cta-motion` / `.cta-enter` in globals.css — same entrance and
                hover as the framer-motion pair this replaces, on the compositor. */}
            <div className="cta-motion cta-enter relative">
                <LandingAppLink href="/send" surface={MIGRATION_SURFACES.LANDING_APP_FOLD}>
                    <Button shadowSize="4" className="bg-white px-6 hover:bg-white/90 md:px-8">
                        {strings.sendNow}
                    </Button>
                </LandingAppLink>
            </div>
        </div>
    )
}
