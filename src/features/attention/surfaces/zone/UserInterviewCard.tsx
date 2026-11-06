'use client'

import posthog from 'posthog-js'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { USER_INTERVIEW_CAL_URL } from '@/constants/general.consts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { openExternalUrl } from '@/utils/capacitor'
import type { ZoneSurfaceProps } from '../../types'

/**
 * User-interview invite (temporary campaign): the cohort lives in the PostHog
 * flag's release condition, never in code. Delete this file, the ask, the flag
 * and the i18n keys when the campaign ends.
 */
export default function UserInterviewCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    return (
        <CarouselCTA
            title={t('userInterview.title')}
            description={t('userInterview.description')}
            mascotPose="waving-hello"
            // the mascot fills its container; widen it so it reads at 44px like the other logos
            iconContainerClassName="size-11"
            onClose={onDismissed}
            onClick={async () => {
                posthog.capture(ANALYTICS_EVENTS.USER_INTERVIEW_CTA_CLICKED)
                // await so a native Browser.open failure surfaces in CarouselCTA's try/catch
                await openExternalUrl(USER_INTERVIEW_CAL_URL)
            }}
        />
    )
}
