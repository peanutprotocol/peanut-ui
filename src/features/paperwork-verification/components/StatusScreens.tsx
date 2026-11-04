'use client'

import { useTranslations } from 'next-intl'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import type {
    PaperworkVerificationClosedFeature,
    PaperworkVerificationFeature,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { VerifyCelebrationLayout, VerifyFooter, VerifyHeroLayout, VerifyQuestionLayout } from './VerifyLayout'
import { useKycControl } from '../analytics'

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
    const controls = useKycControl('answers-saved')
    const line = ({ feature, reason }: PaperworkVerificationClosedFeature) => {
        if (t.has(`closed.${feature}.${reason}` as never)) return t(`closed.${feature}.${reason}` as never)
        const tokens = reason.split(/[._-]/)
        const category =
            tokens.includes('nationality') || reason === 'us_citizen_not_supported'
                ? 'nationality'
                : /(^|[._-])tax[._-](id|identification_number)([._-]|$)/.test(reason)
                  ? 'taxId'
                  : reason.startsWith('residence_') ||
                      reason === 'country_not_supported' ||
                      reason === 'us_state_unsupported'
                    ? 'residence'
                    : 'default'
        return t(`closed.${feature}.${category}` as never)
    }
    return (
        <VerifyCelebrationLayout
            pose="pointing"
            celebrate
            title={t('saved.title')}
            description={t('saved.description')}
            footer={
                <VerifyFooter
                    actions={primary(
                        t('continue'),
                        () => {
                            controls.track('continue', 'tap')
                            onContinue()
                        },
                        'verify-saved-continue',
                        busy
                    )}
                />
            }
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
    policyHold = false,
}: {
    onHome: () => void
    onRetry?: () => void
    busy?: boolean
    error?: string | null
    policyHold?: boolean
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl('id-failed')
    const home = () => {
        controls.track('home', 'tap')
        onHome()
    }
    return (
        <VerifyCelebrationLayout
            pose="sad"
            title={t('failed.title')}
            description={t(policyHold ? 'policyHold.description' : 'failed.description')}
            footer={
                <VerifyFooter
                    actions={
                        onRetry
                            ? primary(
                                  t(policyHold ? 'policyHold.cta' : 'failed.retry'),
                                  () => {
                                      controls.track('retry', 'tap')
                                      onRetry()
                                  },
                                  'verify-review-retry',
                                  busy
                              )
                            : primary(t('failed.cta'), home, 'verify-review-home', false, 'secondary')
                    }
                    secondary={onRetry ? primary(t('failed.cta'), home, 'verify-review-home') : undefined}
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
    const controls = useKycControl('feature-ready', 'kyc_status')
    return (
        <VerifyHeroLayout
            pose="too-cool"
            title={t('addLater.doneTitle')}
            description={t(`addLater.doneDescription.${feature}`)}
            footer={
                <VerifyFooter
                    actions={primary(
                        t('addLater.doneCta'),
                        () => {
                            controls.track('done', 'tap')
                            onDone()
                        },
                        'verify-feature-done'
                    )}
                />
            }
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
    const controls = useKycControl('poa')
    return (
        <VerifyQuestionLayout
            footer={
                <VerifyFooter
                    actions={primary(
                        t('poa.upload'),
                        () => {
                            controls.track('upload', 'tap')
                            onUpload()
                        },
                        'verify-poa-upload',
                        uploading
                    )}
                    secondary={
                        <LinkButton
                            onClick={() => {
                                controls.track('skip', 'tap')
                                onSkip()
                            }}
                            disabled={uploading}
                            data-testid="verify-poa-skip"
                        >
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
