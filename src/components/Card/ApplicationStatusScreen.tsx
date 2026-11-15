'use client'
import type { FC } from 'react'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useTranslations } from 'next-intl'
import NavHeader from '@/components/Global/NavHeader'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { DocumentRequestState } from '@/components/Kyc/DocumentRequestState'
import { useKycControl } from '@/features/paperwork-verification/analytics'

type Variant =
    | 'pending'
    | 'creating-card'
    | 'pending-identity'
    | 'manual-review'
    | 'requires-info'
    | 'requires-support'
    | 'rejected'
    | 'geo-blocked'
    | 'pending-residence-blocked'

interface Props {
    variant: Variant
    /** Display-ready reason from the capabilities read-model
     *  (`rail.reason.userMessage`) — rendered above the generic body so the
     *  user sees what specifically is missing. Provider-neutral by contract.
     *  Fallback only: when `reasonCode` maps to catalog copy, that wins. */
    reasonMessage?: string
    /** Stable `rail.reason.code` — mapped onto localized identity.reasons.*
     *  copy; unknown codes fall back to `reasonMessage` prose. */
    reasonCode?: string
    onContactSupport?: () => void
    /** When the rail carries a self-serve proof-of-address action, this opens
     *  the Sumsub upload flow — rendered as the primary CTA so users fix it
     *  themselves instead of messaging support. */
    onUploadProofOfAddress?: () => void
    /** When the rail carries a `rain-hosted` action (identity document rejected),
     *  this opens Rain's card-member portal to re-upload — the primary CTA so
     *  users fix it themselves instead of hitting the contact-support dead end. */
    onUploadIdentity?: () => void
    informationActions?: Array<{ key: string; kind: InformationKind; label: string; onClick: () => void }>
    /** Inline failure from starting the upload (a silent primary CTA on a
     *  stuck-application screen reads as broken). */
    uploadError?: string
    onPrev?: () => void
}

// The rejected variant's `reasonMessage` (when known) renders above its body;
// the body itself stays reassuring — a declined card doesn't touch the rest of
// the account, so it points the user back to what still works. `geo-blocked`
// is terminal and regulatory (nothing support can do), so it carries the same
// reassurance and no support CTA.
const COPY_KEYS = {
    'creating-card': { title: 'status.creatingCardTitle', body: 'status.creatingCardBody' },
    pending: { title: 'status.pendingTitle', body: 'status.pendingBody' },
    'pending-identity': { title: 'status.pendingTitle', body: 'status.pendingIdentityBody' },
    'manual-review': { title: 'status.manualReviewTitle', body: 'status.manualReviewBody' },
    'requires-info': { title: 'status.requiresInfoTitle', body: 'status.requiresInfoBody' },
    'requires-support': { title: 'status.requiresSupportTitle', body: 'status.requiresSupportBody' },
    rejected: { title: 'status.rejectedTitle', body: 'status.rejectedBody' },
    'geo-blocked': { title: 'status.geoBlockedTitle', body: 'status.geoBlockedBody' },
    'pending-residence-blocked': {
        title: 'status.pendingResidenceBlockedTitle',
        body: 'status.pendingResidenceBlockedBody',
    },
} as const satisfies Record<Variant, { title: string; body: string }>

/** A collected proof of address on its way to, or with, the card partner: nothing for the user to do. */
const AWAITING_DOCUMENT_REVIEW: ReadonlySet<string> = new Set([
    'proof_of_address_received',
    'proof_of_address_review',
    'identity_verification_received',
    'identity_verification_review',
])

export type InformationKind = 'taxId' | 'birthDate'
type SelfServeKind = 'proofOfAddress' | 'identity' | InformationKind

interface SelfServeAction {
    kind: SelfServeKind
    label: string
    onClick: () => void
}

const SELF_SERVE_CONTROLS = {
    proofOfAddress: 'upload_proof_of_address',
    identity: 'upload_identity',
    taxId: 'tax_id',
    birthDate: 'birth_date',
} as const satisfies Record<SelfServeKind, string>

/** A self-serve step on the screen replaces the support line with what to do. */
const REQUIRES_INFO_BODY_KEYS = {
    proofOfAddress: 'status.requiresInfoProofOfAddressBody',
    identity: 'status.requiresInfoIdentityBody',
    taxId: 'status.requiresInfoTaxIdBody',
    birthDate: 'status.requiresInfoBirthDateBody',
} as const satisfies Record<SelfServeKind, string>

/** Variants where support is the only path forward — these render the CTA. */
const SUPPORT_VARIANTS: ReadonlySet<Variant> = new Set(['requires-info', 'requires-support', 'rejected'])

/**
 * The legal policy behind the geo block — §1 "Restricted Countries" lists the
 * issuance denylist. A LEGAL page on purpose: Rain's marketing-compliance
 * rules ban country names / eligibility framing in card-marketing surfaces
 * (help articles included), so this policy page is the one compliant place
 * the full list is published. Mirrors CardTermsScreen's absolute-URL pattern.
 */
const PROHIBITED_ACTIVITIES_POLICY_URL = 'https://peanut.me/en/card-prohibited-activities'
const RESIDENCE_CHANGE_URL = '/settings/details?open=residence'

const ApplicationStatusScreen: FC<Props> = ({
    variant,
    reasonMessage,
    reasonCode,
    onContactSupport,
    onUploadProofOfAddress,
    onUploadIdentity,
    informationActions = [],
    uploadError,
    onPrev,
}) => {
    const isProviderRequest = variant === 'requires-info'
    const { track } = useKycControl(
        isProviderRequest ? 'provider-request' : 'card-status',
        isProviderRequest ? 'kyc_provider_request' : 'kyc_status'
    )
    const handleBack = onPrev
        ? () => {
              track('back', 'tap')
              onPrev()
          }
        : undefined
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const copyKeys = COPY_KEYS[variant]
    const reasonKey = reasonCodeKey(reasonCode)
    const reasonText = reasonKey ? tIdentity(reasonKey) : reasonMessage
    // One fix at a time: if the rail ever carries several, the next shows once this one is done.
    let selfServeAction: SelfServeAction | undefined
    if (SUPPORT_VARIANTS.has(variant)) {
        if (onUploadProofOfAddress) {
            selfServeAction = {
                kind: 'proofOfAddress',
                label: t('uploadProofOfAddress'),
                onClick: onUploadProofOfAddress,
            }
        } else if (onUploadIdentity) {
            selfServeAction = { kind: 'identity', label: t('uploadIdentityDocuments'), onClick: onUploadIdentity }
        } else if (variant === 'requires-info') {
            selfServeAction = informationActions[0]
        }
    }
    // requires-info's default body points at support; the step on screen, or a wait, is the way forward instead
    const bodyKey =
        variant !== 'requires-info'
            ? copyKeys.body
            : selfServeAction
              ? REQUIRES_INFO_BODY_KEYS[selfServeAction.kind]
              : reasonCode && AWAITING_DOCUMENT_REVIEW.has(reasonCode)
                ? 'status.requiresInfoWaitBody'
                : copyKeys.body
    // A document Rain asks for gets the one document-request look the Add money screens share.
    if (
        variant === 'requires-info' &&
        (selfServeAction?.kind === 'proofOfAddress' || selfServeAction?.kind === 'identity')
    )
        return (
            <PageStack>
                <NavHeader title={t('navAddCard')} onPrev={handleBack} />
                <PageStack.Center>
                    <DocumentRequestState
                        reason={reasonText}
                        body={t(bodyKey)}
                        ctaLabel={selfServeAction.label}
                        onCta={selfServeAction.onClick}
                        error={uploadError}
                        onContactSupport={onContactSupport}
                    />
                </PageStack.Center>
            </PageStack>
        )
    return (
        <PageStack>
            <NavHeader title={t('navAddCard')} onPrev={handleBack} />
            {['pending', 'pending-identity', 'manual-review', 'creating-card'].includes(variant) ? (
                <div className="my-auto flex flex-col items-center gap-6 text-center">
                    {(variant === 'pending' || variant === 'pending-identity' || variant === 'creating-card') && (
                        <Loading />
                    )}
                    <div className="flex flex-col gap-3">
                        <h1 className="text-heading-s text-foreground-primary">{t(copyKeys.title)}</h1>
                        {reasonText && <p className="text-foreground-secondary">{reasonText}</p>}
                        <p className="text-foreground-secondary">{t(bodyKey)}</p>
                    </div>
                </div>
            ) : (
                <PageStack.Center>
                    <CenteredStatusCard
                        title={t(copyKeys.title)}
                        description={
                            <>
                                {reasonText && <p>{reasonText}</p>}
                                <p>{t(bodyKey)}</p>
                            </>
                        }
                        tone={
                            variant === 'requires-info' || variant === 'pending-residence-blocked' ? 'warning' : 'error'
                        }
                        pose={variant === 'geo-blocked' ? 'worried' : undefined}
                    >
                        {variant === 'geo-blocked' && (
                            <LinkButton
                                href={PROHIBITED_ACTIVITIES_POLICY_URL}
                                external
                                onClick={() => track('policy', 'tap')}
                            >
                                {t('status.geoBlockedPolicyLink')}
                            </LinkButton>
                        )}
                        {variant === 'pending-residence-blocked' && (
                            <LinkButton href={RESIDENCE_CHANGE_URL} onClick={() => track('change_residence', 'tap')}>
                                {t('status.pendingResidenceBlockedCta')}
                            </LinkButton>
                        )}
                        {selfServeAction && (
                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={() => {
                                    track(SELF_SERVE_CONTROLS[selfServeAction.kind], 'tap')
                                    selfServeAction.onClick()
                                }}
                            >
                                {selfServeAction.label}
                            </Button>
                        )}
                        {SUPPORT_VARIANTS.has(variant) && uploadError && (
                            <p role="alert" className="text-body-s text-foreground-error">
                                {uploadError}
                            </p>
                        )}
                        {SUPPORT_VARIANTS.has(variant) && onContactSupport && (
                            <LinkButton
                                onClick={() => {
                                    track('support', 'tap')
                                    onContactSupport()
                                }}
                            >
                                {tCommon('contactSupport')}
                            </LinkButton>
                        )}
                    </CenteredStatusCard>
                </PageStack.Center>
            )}
        </PageStack>
    )
}

export default ApplicationStatusScreen
