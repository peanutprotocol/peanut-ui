'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { twMerge } from '@/utils/tw'
import { useInsetColor } from '../useInsetColor'
import { StepTimeline, type StepTimelineState } from './StepTimeline'
import { useKycControl } from '../analytics'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'

type StepKey = 'residence' | 'questions' | 'photo' | 'selfie' | 'review' | 'unlock'
/** A step a feature still asks for once the review passed (Rain's proof of address, a bank document). */
export type FollowUpLabel = 'cardAddress' | 'cardIdentity' | 'bankDocument' | 'bankTerms' | 'bankCheck'
type StepRow = { key: string; label: `steps.${StepKey}` | `steps.followUp.${FollowUpLabel}`; state: StepTimelineState }

/**
 * Loading, waiting for the review, or verified: one timeline, its rows filled in as far as the user got. Before
 * the ID check the intro is Verify start (VerifyStartIntro), not this screen.
 */
export type StepsPhase = 'loading' | 'review' | 'verified'

// the rows while the server says which steps are left
const SKELETON_ROWS = 4
const skeleton = 'animate-pulse bg-foreground-primary/10 motion-reduce:animate-none'

const PHASE_COPY = {
    loading: {
        title: 'steps.title',
        note: null,
        cta: 'continue',
        testId: 'verify-steps-continue',
        screenId: 'steps-overview',
        control: 'continue',
    },
    review: {
        title: 'steps.title',
        note: 'review.description',
        cta: 'steps.backHome',
        testId: 'verify-review-home',
        screenId: 'id-checking',
        control: 'home',
    },
    verified: {
        title: 'steps.title',
        note: 'steps.verifiedNote',
        cta: 'steps.setUpPayments',
        testId: 'verify-verified-payments',
        screenId: 'id-confirmed',
        control: 'set_up_payments',
    },
} as const

function stepRows(phase: 'review' | 'verified', hasQuestions: boolean, followUps: readonly FollowUpLabel[]): StepRow[] {
    const keys: StepKey[] = [
        'residence',
        ...(hasQuestions ? (['questions'] as const) : []),
        'photo',
        'selfie',
        'review',
        'unlock',
    ]
    const row = (key: StepKey, state: StepTimelineState): StepRow => ({ key, label: `steps.${key}`, state })
    if (phase === 'verified') {
        // Payments unlock only once every step a feature still asks for is done: those steps
        // come after the review, the first one current, and Unlock waits behind them.
        const reviewed = keys.filter((key) => key !== 'unlock').map((key) => row(key, 'done'))
        const asked = followUps.map(
            (label, index): StepRow => ({
                key: `follow-up-${index}`,
                label: `steps.followUp.${label}`,
                state: index === 0 ? 'current' : 'next',
            })
        )
        return [...reviewed, ...asked, row('unlock', followUps.length ? 'next' : 'done')]
    }
    return keys.map((key) => row(key, key === 'review' ? 'current' : key === 'unlock' ? 'next' : 'done'))
}

/**
 * Where the user is on the way to verified: the questions show only when the
 * features ask any. `loading` is every visit's first frame while the server
 * says which steps are left: the screen with its rows still to fill. After the
 * selfie the same timeline waits on the review, and once verified sends the
 * user on to their payment methods, or first to what a feature still asks for.
 */
export function StepsScreen({
    phase,
    hasQuestions = true,
    aside,
    followUps = [],
    note,
    cta,
    onBack,
    onContinue,
}: {
    phase: StepsPhase
    hasQuestions?: boolean
    /** above the button: a notice for the next step (the bank's refusal) */
    aside?: React.ReactNode
    /** verified: the steps a feature still asks for, after the review and before Unlock */
    followUps?: readonly FollowUpLabel[]
    /** in place of the phase's note and button, for the open follow-up */
    note?: string
    cta?: string
    onBack: () => void
    onContinue?: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    useInsetColor(false)
    const loading = phase === 'loading'
    const rows = loading ? [] : stepRows(phase, hasQuestions, phase === 'verified' ? followUps : [])
    const copy = PHASE_COPY[phase]
    const control = useKycControl(copy.screenId)
    const noteText = note ?? (copy.note ? t(copy.note) : null)
    return (
        <div className={twMerge('flex w-full flex-col bg-background-page px-6 pt-4 pb-6', SCREEN_HEIGHT)}>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-x-6">
                <Button
                    variant="ghost"
                    onClick={() => {
                        control.track('back', 'tap')
                        onBack()
                    }}
                    className={NAV_CIRCLE_BUTTON_CLASSES}
                    aria-label={t('back')}
                    data-testid="verify-back"
                >
                    <Icon name="chevron-up" size={20} className="-rotate-90" />
                </Button>
                <h1 className="text-center text-heading-xs tracking-[-0.3px] whitespace-pre-line text-foreground-primary">
                    {t(copy.title)}
                </h1>
                <span />
            </div>
            {noteText && (
                <p className="mt-3 text-center text-body-s text-foreground-secondary" data-testid="verify-steps-note">
                    {noteText}
                </p>
            )}
            {loading ? (
                <ol aria-hidden className="mt-10 flex flex-col" data-testid="verify-steps-loading">
                    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                        <li
                            key={index}
                            className="relative grid min-h-[4.625rem] grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-6 last:min-h-8 last:pb-0"
                        >
                            {index < SKELETON_ROWS - 1 && (
                                <span className="absolute top-8 bottom-0 left-[15.5px] w-px bg-border-subtle" />
                            )}
                            <span className={twMerge('relative z-10 size-8 rounded-full', skeleton)} />
                            <span className="flex h-8 items-center">
                                <span className={twMerge('h-4 rounded-full', skeleton, index % 2 ? 'w-36' : 'w-52')} />
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <StepTimeline
                    rows={rows.map((row) => ({ ...row, label: t(row.label) }))}
                    doneLabel={t('steps.done')}
                    spinCurrent={phase === 'review'}
                    className="mt-10"
                    testId="verify-steps"
                    phase={phase}
                />
            )}
            <div className="mt-auto flex flex-col gap-4 pt-8">
                {aside}
                <Button
                    shadowSize="4"
                    className="w-full"
                    onClick={() => {
                        control.track(cta ? 'follow_up' : copy.control, 'tap')
                        onContinue?.()
                    }}
                    disabled={loading || !onContinue}
                    data-testid={copy.testId}
                >
                    {cta ?? t(copy.cta)}
                </Button>
            </div>
        </div>
    )
}
