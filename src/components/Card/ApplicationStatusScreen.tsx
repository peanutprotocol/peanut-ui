'use client'
import type { FC } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { PeanutCrying } from '@/assets/mascot'
import NavHeader from '@/components/Global/NavHeader'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'

type Variant = 'pending' | 'manual-review' | 'requires-info' | 'requires-support' | 'rejected' | 'geo-blocked'

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
} as const satisfies Record<Variant, { title: string; body: string }>

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

const ApplicationStatusScreen: FC<Props> = ({
    variant,
    reasonMessage,
    reasonCode,
    onContactSupport,
    onUploadProofOfAddress,
    onUploadIdentity,
    uploadError,
    onPrev,
}) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const copyKeys = COPY_KEYS[variant]
    const reasonKey = reasonCodeKey(reasonCode)
    const reasonText = reasonKey ? tIdentity(reasonKey) : reasonMessage
    return (
        <PageStack>
            <NavHeader title={t('navAddCard')} onPrev={onPrev} />
            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {variant === 'pending' && <Loading />}
                {(variant === 'rejected' || variant === 'requires-support' || variant === 'geo-blocked') && (
                    <Image
                        src={PeanutCrying.src}
                        unoptimized
                        alt={t('status.mascotAlt')}
                        width={128}
                        height={128}
                        className="select-none"
                        priority
                    />
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-heading-s text-foreground-primary">{t(copyKeys.title)}</h1>
                    {reasonText && <p className="text-foreground-secondary">{reasonText}</p>}
                    <p className="text-foreground-secondary">{t(copyKeys.body)}</p>
                </div>
                {variant === 'geo-blocked' && (
                    <LinkButton href={PROHIBITED_ACTIVITIES_POLICY_URL} external>
                        {t('status.geoBlockedPolicyLink')}
                    </LinkButton>
                )}
                {SUPPORT_VARIANTS.has(variant) && onUploadProofOfAddress && (
                    <div className="flex w-full flex-col gap-2">
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={onUploadProofOfAddress}>
                            {t('uploadProofOfAddress')}
                        </Button>
                        {uploadError && <p className="text-body-s text-foreground-error">{uploadError}</p>}
                    </div>
                )}
                {SUPPORT_VARIANTS.has(variant) && onUploadIdentity && (
                    <div className="flex w-full flex-col gap-2">
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={onUploadIdentity}>
                            {t('uploadIdentityDocuments')}
                        </Button>
                        {uploadError && <p className="text-body-s text-foreground-error">{uploadError}</p>}
                    </div>
                )}
                {SUPPORT_VARIANTS.has(variant) && onContactSupport && (
                    <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                )}
            </div>
        </PageStack>
    )
}

export default ApplicationStatusScreen
