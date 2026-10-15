'use client'
import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { AskShell } from '@/features/attention/AskShell'
import DocsLink from '@/components/Global/DocsLink'
import { Callout } from '@/components/0_Bruddle/Callout'
import { legalPolicyForSlug } from '@/constants/legal-policies'
import { acceptedLegalDocument, consentApi } from '@/services/consent'
import { type LegalDocumentSlug } from '@/constants/legal-versions.generated'
import { CONSENT_STATUS_QUERY_KEY } from '@/features/attention/journeyState'
import type { AskSurfaceProps } from '@/features/attention/types'
import { nextPromptAt } from './utils'

/** Keep "Not now" stacked BELOW the primary CTA at every width — side-by-side
 *  would read as two equally-weighted choices. */
const STACKED_CTAS = 'flex-col sm:flex-col'

export interface ReConsentDocument {
    slug: string
    currentVersion: string
}

/**
 * Re-consent click-through (tos-v1 phase 2, ToS §17): when a legal document's
 * published version moves past what the user last provably accepted, this modal
 * lists the updated documents and appends fresh consent-ledger rows on
 * acceptance (POST /users/consent/accept). Whether it shows is the attention
 * manager's call (the `legal-reconsent` ask reads GET /users/consent/status);
 * this component only renders and answers.
 *
 * It is a PROMPT, not a gate. §17.2 gives material changes 30 days and offers
 * the click-through as a way to accept sooner; §17.3 requires that a user who
 * declines can still stop using the Services — which, for a non-custodial
 * wallet, means they must be able to reach `/withdraw`. So "Not now" always
 * exists, and dismissing never writes a ledger row (declining is not consent).
 */
const ReConsentModal = ({
    documents,
    onActed,
    onSnoozed,
    presentation,
}: AskSurfaceProps & { documents: ReConsentDocument[] }) => {
    const t = useTranslations('global')
    const tPolicies = useTranslations('profile.about.policies')
    const queryClient = useQueryClient()
    const [checked, setChecked] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleAccept = async () => {
        if (!checked || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            await consentApi.accept(documents.map((d) => acceptedLegalDocument(d.slug as LegalDocumentSlug)))
            // the ask's verdict turns `done` once the status query reflects the ledger
            await queryClient.invalidateQueries({ queryKey: [CONSENT_STATUS_QUERY_KEY] })
            onActed()
        } catch (e) {
            // Sentry (not console): if /accept fails systematically, nobody can
            // record consent at all — that must be visible in prod
            Sentry.captureException(e, { tags: { feature: 're-consent', action: 'accept' } })
            setError(t('reConsent.saveError'))
        } finally {
            setSubmitting(false)
        }
    }

    /** "Not now", the close button, backdrop and Escape all land here. */
    const handlePostpone = () => {
        if (submitting) return
        // defer to the date these documents actually take effect (§17.2), not a
        // fixed interval — a doc posted today buys the user its full 30 days
        onSnoozed(nextPromptAt(documents.map((d) => d.currentVersion)))
    }

    return (
        <AskShell
            presentation={presentation}
            visible
            onClose={handlePostpone}
            tone="info"
            title={t('reConsent.title')}
            description={
                /* The first sentence answers the question this modal actually raises
                 * ("is something being taken from me?") before anything else. The
                 * what-changed line describes the 2026-07-15 tos-v1 rewrite — revisit
                 * it when a future version bump shows this modal for a different
                 * change. "No rush" is literal: "Not now" snoozes to the effective
                 * date (see utils.ts). */
                <div className="space-y-3">
                    <p>{t('reConsent.reassurance')}</p>
                    <p>{t('reConsent.whatChanged')}</p>
                </div>
            }
            body={
                <div className="space-y-3 w-full">
                    {/* the updated documents on one centered line, separator-joined
                        (wraps when it must) — inline-link treatment per the Signup
                        consent line; DocsLink handles browser and native targets */}
                    <p className="text-body-s">
                        {documents.map((doc, index) => {
                            const policy = legalPolicyForSlug(doc.slug)
                            return (
                                <Fragment key={doc.slug}>
                                    {index > 0 && <span className="text-foreground-secondary"> · </span>}
                                    <DocsLink
                                        href={policy?.href ?? `/${doc.slug}`}
                                        className="text-foreground-primary underline underline-offset-2"
                                    >
                                        {policy ? tPolicies(policy.key) : doc.slug}
                                    </DocsLink>
                                </Fragment>
                            )
                        })}
                    </p>
                    {error && <Callout priority="error">{error}</Callout>}
                </div>
            }
            checkbox={{
                text: t('reConsent.acceptLabel'),
                checked,
                onChange: setChecked,
            }}
            ctas={[
                {
                    text: submitting ? t('reConsent.saving') : t('reConsent.acceptCta'),
                    variant: 'primary',
                    shadowSize: '4',
                    disabled: !checked || submitting,
                    onClick: handleAccept,
                    // ActionModal's sm:flex-1 (meant for its side-by-side layout)
                    // squashes h-13 buttons when the CTAs are stacked
                    className: 'sm:flex-none',
                },
            ]}
            tertiaryCta={{ text: t('reConsent.notNow'), disabled: submitting, onClick: handlePostpone }}
            ctaClassName={STACKED_CTAS}
        />
    )
}

export default ReConsentModal
