'use client'

import { useTranslations } from 'next-intl'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import type {
    PaperworkVerificationClosedFeature,
    PaperworkVerificationFeature,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { twMerge } from '@/utils/tw'
import { useInsetColor } from '../useInsetColor'
import { VerifyCelebrationLayout, VerifyFooter, VerifyHeroLayout, VerifyQuestionLayout } from './VerifyLayout'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'

const primary = (label: string, onClick: () => void, testId: string, loading = false, variant?: ButtonVariant) => (
    <Button
        variant={variant}
        shadowSize="4"
        className="w-full"
        onClick={onClick}
        loading={loading}
        disabled={loading}
        data-testid={testId}
    >
        {label}
    </Button>
)

type StepState = 'done' | 'current' | 'next'
type StepKey = 'residence' | 'questions' | 'photo' | 'selfie' | 'review' | 'unlock'
type StepRow = { key: StepKey; state: StepState }

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

function stepRows(phase: StepsPhase, hasQuestions: boolean, questionsDone: boolean): StepRow[] {
    const keys: StepKey[] = [
        'residence',
        ...(hasQuestions ? (['questions'] as const) : []),
        'photo',
        'selfie',
        'review',
        'unlock',
    ]
    if (phase === 'verified') return keys.map((key) => ({ key, state: 'done' }))
    if (phase === 'review')
        return keys.map((key) => ({ key, state: key === 'review' ? 'current' : key === 'unlock' ? 'next' : 'done' }))
    const photoCurrent = !hasQuestions || questionsDone
    return keys.map((key) => ({
        key,
        state:
            key === 'residence' || (key === 'questions' && questionsDone)
                ? 'done'
                : key === 'questions' || (key === 'photo' && photoCurrent)
                  ? 'current'
                  : 'next',
    }))
}

/**
 * Where the user is on the way to verified: the questions show only when the
 * features ask any. `loading` is every visit's first frame while the server
 * says which steps are left: the screen with its rows still to fill. After the
 * selfie the same timeline waits on the review, and once verified sends the
 * user on to their payment methods.
 */
export function StepsScreen({
    phase = 'intro',
    hasQuestions = true,
    questionsDone = false,
    loading = false,
    onBack,
    onContinue,
}: {
    phase?: StepsPhase
    hasQuestions?: boolean
    questionsDone?: boolean
    loading?: boolean
    onBack: () => void
    onContinue?: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    useInsetColor(false)
    const rows = stepRows(phase, hasQuestions, questionsDone)
    const copy = PHASE_COPY[phase]
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
            {copy.note && (
                <p className="mt-3 text-center text-body-s text-foreground-secondary" data-testid="verify-steps-note">
                    {t(copy.note)}
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
                            <span className="flex h-8 items-center text-body-m-semibold text-foreground-primary">
                                {t(`steps.${row.key}`)}
                                {row.state === 'done' && <span className="sr-only"> {t('steps.done')}</span>}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <div className="mt-auto pt-8">
                <Button
                    shadowSize="4"
                    className="w-full"
                    onClick={onContinue}
                    disabled={loading || !onContinue}
                    data-testid={copy.testId}
                >
                    {t(copy.cta)}
                </Button>
            </div>
        </div>
    )
}

/** The last answer is saved: the ID check comes next. */
/** `busy` while the last answers are still on their way to the server. */
export function SavedScreen({
    busy = false,
    closed = [],
    onContinue,
}: {
    busy?: boolean
    /** What the residence or an answer closed of the user's pick, said before the ID check. */
    closed?: PaperworkVerificationClosedFeature[]
    onContinue: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const line = ({ feature, reason }: PaperworkVerificationClosedFeature) =>
        t.has(`closed.${feature}.${reason}` as never)
            ? t(`closed.${feature}.${reason}` as never)
            : t(`closed.${feature}.default` as never)
    return (
        <VerifyCelebrationLayout
            pose="pointing"
            celebrate
            title={t('saved.title')}
            description={t('saved.description')}
            footer={<VerifyFooter actions={primary(t('continue'), onContinue, 'verify-saved-continue', busy)} />}
        >
            {closed.length > 0 && (
                <Callout priority="info" className="w-full max-w-80 text-left" data-testid="verify-closed-features">
                    {closed.map((c) => (
                        <span key={c.feature} className="block">
                            {line(c)}
                        </span>
                    ))}
                    <span className="block">{t('closed.rest')}</span>
                </Callout>
            )}
        </VerifyCelebrationLayout>
    )
}

/** The ID check failed or needs another try: Home, or a retry when Sumsub allows one. */
export function ReviewScreen({
    onHome,
    onRetry,
    busy = false,
    error,
}: {
    onHome: () => void
    onRetry?: () => void
    busy?: boolean
    error?: string | null
}) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <VerifyCelebrationLayout
            pose="sad"
            title={t('failed.title')}
            description={t('failed.description')}
            footer={
                <VerifyFooter
                    actions={
                        onRetry
                            ? primary(t('failed.retry'), onRetry, 'verify-review-retry', busy)
                            : primary(t('failed.cta'), onHome, 'verify-review-home', false, 'secondary')
                    }
                    secondary={onRetry ? primary(t('failed.cta'), onHome, 'verify-review-home') : undefined}
                >
                    {error && <Callout priority="error">{error}</Callout>}
                </VerifyFooter>
            }
        />
    )
}

/** Add-later is saved: the providers take it from here, and the account rows show their status. */
export function FeatureReadyScreen({ feature, onDone }: { feature: PaperworkVerificationFeature; onDone: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <VerifyHeroLayout
            pose="too-cool"
            title={t('addLater.doneTitle')}
            description={t(`addLater.doneDescription.${feature}`)}
            footer={<VerifyFooter actions={primary(t('addLater.doneCta'), onDone, 'verify-feature-done')} />}
        />
    )
}

const PROOF_KINDS = [
    { key: 'bankStatement', icon: 'docs' },
    { key: 'utilityBill', icon: 'bulb' },
    { key: 'taxLetter', icon: 'bank' },
] as const

/**
 * Rule 1: the ID is from another country than the residence and a bank
 * account was picked, so Bridge will want a proof of address. Suggested, never
 * required: Skip leaves no task behind and the bank account still opens.
 */
export function ProofOfAddressScreen({
    residenceName,
    temporaryProtection = false,
    uploading,
    error,
    onUpload,
    onSkip,
}: {
    residenceName: string
    /** The approved ID was a temporary protection sheet: the residence's own, so not an ID from abroad. */
    temporaryProtection?: boolean
    uploading: boolean
    error: string | null
    onUpload: () => void
    onSkip: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <VerifyQuestionLayout
            footer={
                <VerifyFooter
                    actions={primary(t('poa.upload'), onUpload, 'verify-poa-upload', uploading)}
                    secondary={
                        <LinkButton onClick={onSkip} disabled={uploading} data-testid="verify-poa-skip">
                            {t('poa.skip')}
                        </LinkButton>
                    }
                >
                    {error && (
                        <Callout priority="error" className="w-full text-left">
                            {error}
                        </Callout>
                    )}
                </VerifyFooter>
            }
        >
            <SetupTitleBlock
                title={t('poa.title')}
                description={t(temporaryProtection ? 'poa.descriptionTemporaryProtection' : 'poa.description', {
                    country: residenceName,
                })}
                size="m"
            />
            <ListGroup>
                {PROOF_KINDS.map(({ key, icon }) => (
                    <ListItem
                        key={key}
                        title={t(`poa.kinds.${key}`)}
                        body={t('poa.recent')}
                        leading={<IconBubble icon={icon} size="s" color="blue" />}
                    />
                ))}
            </ListGroup>
            <p className="text-body-s text-foreground-secondary">{t('poa.skipNote')}</p>
        </VerifyQuestionLayout>
    )
}
