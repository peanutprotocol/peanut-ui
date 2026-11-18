'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { StepTimeline } from '@/features/paperwork-verification/components/StepTimeline'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

export type VerifyStartScreenProps = {
    /** the questions are still to answer: their row leads; otherwise the ID photo is the only step left */
    questions: boolean
    /** the check is the card issuer's: it leads to the card, not bank details */
    card?: boolean
    starting?: boolean
    onVerify: () => void
    onLater: () => void
    verifyTestId?: string
    /** under the steps: the provider row Brazil's Resolution 520 wants on every ID screen (TASK-23295) */
    aside?: ReactNode
}

/**
 * The one verify intro (Kush, 2026-11-18): a pink band with "Verify now" and what it unlocks, the steps the person
 * still acts on (Konrad's wording; Hugo dropped Review, 2026-11-17), the pink primary "Verify now · 3 min" (2 min
 * once the questions are answered) and a "Remind me later" link. No art: Konrad drew none. Rendered in a shell of
 * its own by VerifyStartIntro.
 */
export function VerifyStartScreen({
    questions,
    card = false,
    starting = false,
    onVerify,
    onLater,
    verifyTestId = 'setup-redesign-verify-now',
    aside,
}: VerifyStartScreenProps) {
    const t = useTranslations('setupRedesign.verifyStart')
    const tSteps = useTranslations('kyc.paperworkVerification.steps')
    const restrictions = useResidenceRestrictions()
    // bank rails closed but the card open: verifying unlocks the card, not bank details (Chip on ui#4138)
    const cardOnly = card || (restrictions.banking && !restrictions.card)
    const labels = [...(questions ? [['questions', t('stepQuestions')]] : []), ['photo', t('stepPhoto')]]

    return (
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
                        {t(cardOnly ? 'subCard' : 'sub')}
                    </p>
                </div>
            }
            footer={{
                primary: {
                    // without the questions only the ID photo and selfie are left: two minutes, not three
                    label: t(questions ? 'verifyNow' : 'verifyNowIdOnly'),
                    loading: starting,
                    // one start per tap: a second tap while it starts does nothing, as sign-up's loading buttons
                    onClick: () => {
                        if (!starting) onVerify()
                    },
                    testId: verifyTestId,
                },
                slot: (
                    <LinkButton onClick={onLater} disabled={starting}>
                        {t('remindLater')}
                    </LinkButton>
                ),
            }}
        >
            <StepTimeline
                rows={labels.map(([key, label], index) => ({ key, label, state: index ? 'next' : 'current' }))}
                doneLabel={tSteps('done')}
                testId="setup-redesign-verify-steps"
            />
            {aside && <div className="mt-6">{aside}</div>}
        </SetupScreen>
    )
}
