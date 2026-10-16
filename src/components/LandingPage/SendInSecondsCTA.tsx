'use client'

import { LandingAppLink } from './LandingAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'
import { CTA_WIDTH } from '@/components/Marketing/constants'

export function SendInSecondsCTA({ strings }: { strings: LandingStrings }) {
    return (
        <div className={`relative mx-auto mt-12 md:mt-24 ${CTA_WIDTH}`}>
            {/* `.cta-motion` / `.cta-enter` in globals.css — same entrance and
                hover as the framer-motion pair this replaces, on the compositor. */}
            <div className="cta-motion cta-enter relative">
                <LandingAppLink href="/send" surface={MIGRATION_SURFACES.LANDING_APP_FOLD} className="block">
                    <Button variant="secondary">{strings.sendNow}</Button>
                </LandingAppLink>
            </div>
        </div>
    )
}
