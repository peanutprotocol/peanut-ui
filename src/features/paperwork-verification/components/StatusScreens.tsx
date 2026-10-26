'use client'

import { useLocale, useTranslations } from 'next-intl'
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
import type { KycFeatures } from '@/app/actions/types/kyc-workflow.types'
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
type StepRow = { key: 'residence' | 'questions' | 'photo' | 'selfie' | 'review' | 'unlock'; state: StepState }

const SKELETON_ROWS = 6
const skeleton = 'animate-pulse bg-foreground-primary/10 motion-reduce:animate-none'

/**
 * Where the user is on the way to verified: the questions show only when the
 * features ask any. `loading` is every visit's first frame while the server
 * says which steps are left: the screen with its rows still to fill.
 */
export function StepsScreen({
    hasQuestions = true,
    questionsDone = false,
    loading = false,
    onBack,
    onContinue,
}: {
    hasQuestions?: boolean
    questionsDone?: boolean
    loading?: boolean
    onBack: () => void
    onContinue?: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    useInsetColor(false)
    const photoCurrent = !hasQuestions || questionsDone
    const questions: StepRow[] = hasQuestions ? [{ key: 'questions', state: questionsDone ? 'done' : 'current' }] : []
    const rows: StepRow[] = [
        { key: 'residence', state: 'done' },
        ...questions,
        { key: 'photo', state: photoCurrent ? 'current' : 'next' },
        { key: 'selfie', state: 'next' },
        { key: 'review', state: 'next' },
        { key: 'unlock', state: 'next' },
    ]
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
                    {t('steps.title')}
                </h1>
                <span />
            </div>
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
                <ol className="mt-10 flex flex-col" data-testid="verify-steps">
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
                                {row.state === 'done' ? <Icon name="check" size={16} /> : index + 1}
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
                    data-testid="verify-steps-continue"
                >
                    {t('continue')}
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

const SETUP_FEATURES = ['bank', 'card', 'local'] as const

/** The features being set up, in a sentence ("bank accounts and card"); empty when only QR pay is on. */
function useSetupFeatures(features: KycFeatures | undefined) {
    const t = useTranslations('kyc.paperworkVerification')
    const locale = useLocale()
    const names = SETUP_FEATURES.filter((f) => features?.[f]).map((f) => t(`featureNames.${f}`))
    return { names: new Intl.ListFormat(locale, { type: 'conjunction' }).format(names), count: names.length }
}

type WaitState = 'done' | 'current' | 'next'

function WaitList({ rows }: { rows: { label: string; state: WaitState }[] }) {
    return (
        <ul className="mt-2 flex w-full max-w-[18.5rem] flex-col gap-3 text-left" data-testid="verify-review-steps">
            {rows.map((row) => (
                <li
                    key={row.label}
                    aria-current={row.state === 'current' ? 'step' : undefined}
                    className={twMerge(
                        'flex items-center gap-3',
                        row.state === 'current'
                            ? 'text-body-s-semibold text-foreground-primary'
                            : 'text-body-s text-foreground-secondary'
                    )}
                >
                    <span
                        aria-hidden
                        className={twMerge(
                            'flex size-6 shrink-0 items-center justify-center rounded-full',
                            row.state === 'done'
                                ? 'bg-background-icon-bubble-green'
                                : row.state === 'current'
                                  ? 'bg-background-icon-bubble-yellow'
                                  : 'bg-background-icon-bubble-gray'
                        )}
                    >
                        {row.state === 'done' && <Icon name="check" size={16} />}
                        {row.state === 'current' && (
                            <span className="size-3 animate-spin rounded-full border-2 border-black border-r-transparent motion-reduce:animate-none" />
                        )}
                    </span>
                    {row.label}
                </li>
            ))}
        </ul>
    )
}

/** After the selfie: wait for review, or resume a retryable ID check. */
export function ReviewScreen({
    failed,
    features,
    onHome,
    onRetry,
    busy = false,
    error,
}: {
    failed: boolean
    features?: KycFeatures
    onHome: () => void
    onRetry?: () => void
    busy?: boolean
    error?: string | null
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const setup = useSetupFeatures(features)
    const copy = failed ? 'failed' : 'review'
    return (
        <VerifyCelebrationLayout
            pose={failed ? 'sad' : 'thinking'}
            title={t(`${copy}.title`)}
            description={t(`${copy}.description`)}
            footer={
                <VerifyFooter
                    actions={
                        onRetry
                            ? primary(t('failed.retry'), onRetry, 'verify-review-retry', busy)
                            : primary(t(`${copy}.cta`), onHome, 'verify-review-home', false, 'secondary')
                    }
                    secondary={onRetry ? primary(t('failed.cta'), onHome, 'verify-review-home') : undefined}
                >
                    {error && <Callout priority="error">{error}</Callout>}
                </VerifyFooter>
            }
        >
            {!failed && (
                <WaitList
                    rows={[
                        { label: t('review.photos'), state: 'done' },
                        { label: t('review.reading'), state: 'current' },
                        {
                            label: setup.count
                                ? t('review.settingUp', { features: setup.names })
                                : t('review.unlocking'),
                            state: 'next',
                        },
                    ]}
                />
            )}
        </VerifyCelebrationLayout>
    )
}

/** Approved: Home's next step is adding money. */
export function VerifiedScreen({ features, onHome }: { features?: KycFeatures; onHome: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    const setup = useSetupFeatures(features)
    return (
        <VerifyCelebrationLayout
            pose="cheering"
            celebrate
            title={t('verified.title')}
            description={
                setup.count ? t('verified.description', { features: setup.names }) : t('verified.descriptionQrOnly')
            }
            footer={<VerifyFooter actions={primary(t('verified.cta'), onHome, 'verify-verified-home')} />}
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
    uploading,
    error,
    onUpload,
    onSkip,
}: {
    residenceName: string
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
                description={t('poa.description', { country: residenceName })}
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
