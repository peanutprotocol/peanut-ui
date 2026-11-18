'use client'

import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { StepTimeline } from '@/features/paperwork-verification/components/StepTimeline'
import { useVerifyStart } from './useVerifyStart'

/**
 * Verify start (signup v7, after the Celebration's Verify now): a pink band with "Verify now" and what it unlocks,
 * the two ID-check steps the person acts on on white (Konrad's wording; Hugo dropped Review, 2026-11-17), the pink
 * primary "Verify now · 3 min" and a "Remind me later" link to Home. No art: Konrad drew none.
 */
export function VerifyStartScreen() {
    const t = useTranslations('setupRedesign.verifyStart')
    const tSteps = useTranslations('kyc.paperworkVerification.steps')
    const start = useVerifyStart()

    return (
        <>
            <SetupScreen
                ground="pink"
                stage="compact"
                chrome={{ back: false, dots: false, lang: false }}
                state="verify-start"
                testId="setup-redesign-verify-start"
                stageCopy={
                    // the band's copy sits on its bottom edge, as Konrad drew it
                    <div className="absolute inset-x-[var(--sr-gutter)] bottom-[calc(100%-var(--sr-stage-compact)+1.5rem)] signup-sm:bottom-[calc(100%-var(--sr-stage-compact)+1rem)]">
                        <h1 className="text-heading-m text-balance signup-sm:text-heading-s">{t('title')}</h1>
                        <p className="mt-2 text-body-m text-foreground-primary signup-sm:mt-1 signup-sm:text-body-s">
                            {t(start.cardOnly ? 'subCard' : 'sub')}
                        </p>
                    </div>
                }
                footer={{
                    primary: {
                        label: t('verifyNow'),
                        loading: start.starting,
                        onClick: () => void start.verify(),
                        testId: 'setup-redesign-verify-now',
                    },
                    slot: (
                        <LinkButton onClick={start.later} disabled={start.starting}>
                            {t('remindLater')}
                        </LinkButton>
                    ),
                }}
            >
                <StepTimeline
                    rows={[
                        { key: 'questions', label: t('stepQuestions'), state: 'current' },
                        { key: 'photo', label: t('stepPhoto'), state: 'next' },
                    ]}
                    doneLabel={tSteps('done')}
                    testId="setup-redesign-verify-steps"
                />
            </SetupScreen>
            {start.modals}
            <SumsubKycModals flow={start.kycFlow} />
        </>
    )
}
