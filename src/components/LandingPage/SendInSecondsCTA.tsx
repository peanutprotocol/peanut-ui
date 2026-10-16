'use client'

import { LandingAppLink } from './LandingAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import type { LandingStrings } from './landingStrings'
import { CTA_MOTION } from '@/components/Marketing/constants'

export function SendInSecondsCTA({ strings }: { strings: LandingStrings }) {
    return (
        <div className="relative mt-12 flex justify-center md:mt-24">
            <LandingAppLink
                href="/send"
                surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                className={`w-fit ${CTA_MOTION}`}
            >
                {strings.sendNow}
            </LandingAppLink>
        </div>
    )
}
