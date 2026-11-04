'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { twMerge } from '@/utils/tw'
import { useInsetColor } from '../useInsetColor'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'

type StepState = 'done' | 'current' | 'next'
type StepKey = 'residence' | 'questions' | 'photo' | 'selfie' | 'review' | 'unlock'
/** A step a feature still asks for once the review passed (Rain's proof of address, a bank document). */
export type FollowUpLabel = 'cardAddress' | 'cardIdentity' | 'bankDocument' | 'bankTerms' | 'bankCheck'
type StepRow = { key: string; label: `steps.${StepKey}` | `steps.followUp.${FollowUpLabel}`; state: StepState }

/** Before the ID check, waiting for its review, or verified: one timeline, its rows filled in as far as the user got. */
export type StepsPhase = 'intro' | 'review' | 'verified'

const SKELETON_ROWS = 6
const skeleton = 'animate-pulse bg-foreground-primary/10 motion-reduce:animate-none'

const PHASE_COPY = {
    intro: { title: 'steps.title', note: null, cta: 'continue', testId: 'verify-steps-continue' },
    review: { title: 'steps.title', note: 'review.description', cta: 'steps.backHome', testId: 'verify-review-home' },
    verified: {
        title: 'steps.title',
        note: 'steps.verifiedNote',
        cta: 'steps.setUpPayments',
        testId: 'verify-verified-payments',
    },
} as const

function stepRows(
    phase: StepsPhase,
    hasQuestions: boolean,
    questionsDone: boolean,
    followUps: readonly FollowUpLabel[]
): StepRow[] {
    const keys: StepKey[] = [
        'residence',
        ...(hasQuestions ? (['questions'] as const) : []),
        'photo',
        'selfie',
        'review',
        'unlock',
    ]
    const row = (key: StepKey, state: StepState): StepRow => ({ key, label: `steps.${key}`, state })
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
    if (phase === 'review')
        return keys.map((key) => row(key, key === 'review' ? 'current' : key === 'unlock' ? 'next' : 'done'))
    const photoCurrent = !hasQuestions || questionsDone
    return keys.map((key) =>
        row(
            key,
            key === 'residence' || (key === 'questions' && questionsDone)
                ? 'done'
                : key === 'questions' || (key === 'photo' && photoCurrent)
                  ? 'current'
                  : 'next'
        )
    )
}

/**
 * Where the user is on the way to verified: the questions show only when the
 * features ask any. `loading` is every visit's first frame while the server
 * says which steps are left: the screen with its rows still to fill. After the
 * selfie the same timeline waits on the review, and once verified sends the
 * user on to their payment methods, or first to what a feature still asks for.
 */
export function StepsScreen({
    phase = 'intro',
    hasQuestions = true,
    questionsDone = false,
    loading = false,
    busy = false,
    continueTestId,
    aside,
    followUps = [],
    note,
    cta,
    onBack,
    onContinue,
}: {
    phase?: StepsPhase
    hasQuestions?: boolean
    questionsDone?: boolean
    loading?: boolean
    /** while the start Continue makes is on its way */
    busy?: boolean
    continueTestId?: string
    /** above the button: the provider today's flow opens an account with */
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
    const rows = stepRows(phase, hasQuestions, questionsDone, phase === 'verified' ? followUps : [])
    const copy = PHASE_COPY[phase]
    const noteText = note ?? (copy.note ? t(copy.note) : null)
    return (
        <div className={twMerge('flex w-full flex-col bg-white px-6 pt-4 pb-6', SCREEN_HEIGHT)}>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-x-6">
                <Button
                    variant="ghost"
                    onClick={onBack}
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
                <ol className="mt-10 flex flex-col" data-testid="verify-steps" data-phase={phase}>
                    {rows.map((row, index) => (
                        <li
                            key={row.key}
                            aria-current={row.state === 'current' ? 'step' : undefined}
                            className="relative grid min-h-[4.625rem] grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-6 last:min-h-8 last:pb-0"
                        >
                            {index < rows.length - 1 && (
                                <span
                                    aria-hidden
                                    className="absolute top-8 bottom-0 left-[15.5px] w-px bg-border-subtle"
                                />
                            )}
                            <span
                                aria-hidden
                                className={twMerge(
                                    'relative z-10 flex size-8 items-center justify-center rounded-full text-body-m-semibold text-foreground-primary',
                                    row.state === 'done'
                                        ? 'bg-background-icon-bubble-green'
                                        : row.state === 'current'
                                          ? 'bg-background-icon-bubble-yellow'
                                          : 'bg-background-icon-bubble-gray'
                                )}
                            >
                                {row.state === 'done' ? (
                                    <Icon name="check" size={16} />
                                ) : row.state === 'current' && phase === 'review' ? (
                                    <span className="size-3.5 animate-spin rounded-full border-2 border-black border-r-transparent motion-reduce:animate-none" />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            {/* min-h, not h: a follow-up's label can take two lines on a narrow phone;
                                self-start keeps a one-line label on its circle instead of stretching to the row */}
                            <span className="flex min-h-8 items-center self-start text-body-m-semibold text-foreground-primary">
                                {t(row.label)}
                                {row.state === 'done' && <span className="sr-only"> {t('steps.done')}</span>}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <div className="mt-auto flex flex-col gap-4 pt-8">
                {aside}
                <Button
                    shadowSize="4"
                    className="w-full"
                    onClick={onContinue}
                    loading={busy}
                    disabled={loading || busy || !onContinue}
                    data-testid={continueTestId ?? copy.testId}
                >
                    {cta ?? t(copy.cta)}
                </Button>
            </div>
        </div>
    )
}
