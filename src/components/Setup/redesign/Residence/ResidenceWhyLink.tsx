'use client'

import { useTranslations } from 'next-intl'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { WhyWeAskSheet } from '@/features/paperwork-verification/components/WhyWeAskSheet'

/**
 * "Why do we ask?" on Residence: the verify questions' sheet with its nationality reason (v7). `withHint` also puts
 * "Tap a country to change it." in the sheet, for the info-line option that shows no line on the screen.
 */
export function ResidenceWhyLink({ withHint }: { withHint: boolean }) {
    const t = useTranslations('kyc.paperworkVerification')
    const tResidence = useTranslations('setupRedesign.residence')
    const { track } = useSignupControl()
    return (
        <WhyWeAskSheet
            link={t('whyAsk')}
            title={t('whyTitle')}
            reasons={[...(withHint ? [tResidence('hint')] : []), t('why.nationality'), t('whyShared')]}
            testId="setup-residence-why"
            onOpen={() => track('why', 'open')}
            onDismiss={() => track('why', 'dismiss')}
            onGotIt={() => track('why_got_it', 'tap')}
        />
    )
}
