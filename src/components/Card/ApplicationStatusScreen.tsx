'use client'
import type { FC } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useTranslations } from 'next-intl'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import NavHeader from '@/components/Global/NavHeader'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'

type Variant =
    | 'pending'
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
    pending: { title: 'status.pendingTitle', body: 'status.pendingBody' },
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

export type InformationKind = 'taxId' | 'birthDate'

/** A self-serve step on the screen replaces the support line with what to do. */
function requiresInfoBodyKey(kinds: InformationKind[], uploadsProofOfAddress: boolean, uploadsIdentity: boolean) {
    const hasTaxId = kinds.includes('taxId')
    const hasBirthDate = kinds.includes('birthDate')
    const uploads = Number(uploadsProofOfAddress) + Number(uploadsIdentity)
    if (uploads > 1 || (uploads > 0 && kinds.length > 0)) return 'status.requiresInfoStepsBody'
    if (hasTaxId && hasBirthDate) return 'status.requiresInfoTaxIdAndBirthDateBody'
    if (hasTaxId) return 'status.requiresInfoTaxIdBody'
    if (hasBirthDate) return 'status.requiresInfoBirthDateBody'
    if (uploadsProofOfAddress) return 'status.requiresInfoProofOfAddressBody'
    if (uploadsIdentity) return 'status.requiresInfoIdentityBody'
    return COPY_KEYS['requires-info'].body
}

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
const RESIDENCE_CHANGE_URL = '/profile/payments?open=residence'

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
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const copyKeys = COPY_KEYS[variant]
    const reasonKey = reasonCodeKey(reasonCode)
    const reasonText = reasonKey ? tIdentity(reasonKey) : reasonMessage
    const bodyKey =
        variant === 'requires-info'
            ? requiresInfoBodyKey(
                  informationActions.map((action) => action.kind),
                  !!onUploadProofOfAddress,
                  !!onUploadIdentity
              )
            : copyKeys.body
    const selfServeActions: Array<{ key: string; label: string; onClick: () => void }> = []
    if (SUPPORT_VARIANTS.has(variant)) {
        if (onUploadProofOfAddress) {
            selfServeActions.push({
                key: 'proof-of-address',
                label: t('uploadProofOfAddress'),
                onClick: onUploadProofOfAddress,
            })
        }
        if (onUploadIdentity) {
            selfServeActions.push({ key: 'identity', label: t('uploadIdentityDocuments'), onClick: onUploadIdentity })
        }
        if (variant === 'requires-info') selfServeActions.push(...informationActions)
    }
    return (
        <PageStack>
            <NavHeader title={t('navAddCard')} onPrev={onPrev} />
            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {variant === 'pending' && <Loading />}
                {(variant === 'rejected' || variant === 'requires-support' || variant === 'geo-blocked') && (
                    <PeanutMascot
                        pose="worried"
                        alt={t('status.mascotAlt')}
                        className={`${MASCOT_STATE_CLASS} select-none`}
                    />
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-heading-s text-foreground-primary">{t(copyKeys.title)}</h1>
                    {reasonText && <p className="text-foreground-secondary">{reasonText}</p>}
                    <p className="text-foreground-secondary">{t(bodyKey)}</p>
                </div>
                {variant === 'geo-blocked' && (
                    <LinkButton href={PROHIBITED_ACTIVITIES_POLICY_URL} external>
                        {t('status.geoBlockedPolicyLink')}
                    </LinkButton>
                )}
                {variant === 'pending-residence-blocked' && (
                    <LinkButton href={RESIDENCE_CHANGE_URL}>{t('status.pendingResidenceBlockedCta')}</LinkButton>
                )}
                {selfServeActions.map((action, index) => (
                    <Button
                        key={action.key}
                        variant={index === 0 ? 'primary' : 'secondary'}
                        className="w-full"
                        onClick={action.onClick}
                    >
                        {action.label}
                    </Button>
                ))}
                {SUPPORT_VARIANTS.has(variant) && uploadError && (
                    <p role="alert" className="text-body-s text-foreground-error">
                        {uploadError}
                    </p>
                )}
                {SUPPORT_VARIANTS.has(variant) && onContactSupport && (
                    <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                )}
            </div>
        </PageStack>
    )
}

export default ApplicationStatusScreen
