'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import ActionModal from '../ActionModal'
import DocsLink from '@/components/Global/DocsLink'
import { useAuth } from '@/context/authContext'
import { acceptedLegalDocument, consentApi, type ConsentStatusDocument } from '@/services/consent'
import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentSlug } from '@/constants/legal-versions.generated'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { isReConsentSnoozed, snoozeReConsent } from './utils'

const DOC_LABELS: Record<string, { name: string; href: string }> = {
    terms: { name: 'Terms of Service', href: '/terms' },
    privacy: { name: 'Privacy Policy', href: '/privacy' },
    'card-terms-us': { name: 'Card Terms (U.S.)', href: '/card-terms-us' },
    'card-terms-international': { name: 'Card Terms (International)', href: '/card-terms-international' },
    'card-esign': { name: 'E-Sign Consent', href: '/card-esign' },
    'card-privacy': { name: 'Account Opening Privacy Notice', href: '/card-privacy' },
    'card-prohibited-activities': { name: 'Prohibited Activities Policy', href: '/card-prohibited-activities' },
}

/** Keep "Not now" stacked BELOW the primary CTA at every width — side-by-side
 *  would read as two equally-weighted choices. */
const STACKED_CTAS = 'flex-col sm:flex-col'

/**
 * Re-consent click-through (tos-v1 phase 2, ToS §17): when a legal document's
 * published version moves past what the user last provably accepted, this modal
 * lists the updated documents and appends fresh consent-ledger rows on
 * acceptance. Backed by GET /users/consent/status and POST /users/consent/accept.
 *
 * It is a PROMPT, not a gate. §17.2 gives material changes 30 days and offers
 * the click-through as a way to accept sooner; §17.3 requires that a user who
 * declines can still stop using the Services — which, for a non-custodial
 * wallet, means they must be able to reach `/withdraw`. So "Not now" always
 * exists, and dismissing never writes a ledger row (declining is not consent).
 */
const ReConsentModal = () => {
    const t = useTranslations('global')
    const { user } = useAuth()
    const [outdatedDocs, setOutdatedDocs] = useState<ConsentStatusDocument[]>([])
    const [checked, setChecked] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const lastCheckedUserId = useRef<string | null>(null)

    useEffect(() => {
        // once per user per session — keyed by userId so a logout → login as a
        // different account still gets its own check
        const userId = user?.user.userId
        if (!userId || lastCheckedUserId.current === userId) return
        lastCheckedUserId.current = userId
        // account switched: none of the previous user's consent state may leak
        // into this session (an already-populated modal or a pre-ticked box)
        setOutdatedDocs([])
        setChecked(false)
        setError(null)
        // a recent "Not now" defers the prompt — don't even spend the request
        if (isReConsentSnoozed(userId)) return
        consentApi
            .getStatus()
            .then((status) => {
                // a slow response for the previous account must not populate
                // the modal for whoever is logged in now
                if (lastCheckedUserId.current !== userId) return
                if (!status.needsReConsent) return
                // only prompt for documents this client can actually display
                const docs = status.documents.filter((d) => d.needsAcceptance && d.slug in LEGAL_DOCUMENT_VERSIONS)
                if (!docs.length) return
                setOutdatedDocs(docs)
                posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, {
                    modal_type: MODAL_TYPES.RE_CONSENT,
                    documents: docs.map((d) => d.slug),
                })
            })
            .catch((e) => {
                // a failed status check must never block the app — retry next
                // session. Sentry (not console): a systematic failure here means
                // re-consent silently stops rolling out, and prod must say so.
                Sentry.captureException(e, { tags: { feature: 're-consent', action: 'status' } })
            })
    }, [user])

    const handleAccept = async () => {
        if (!checked || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            await consentApi.accept(outdatedDocs.map((d) => acceptedLegalDocument(d.slug as LegalDocumentSlug)))
            // CTA_CLICKED, not DISMISSED — acceptance and refusal must be
            // distinguishable, since their ratio is the rollout's headline metric
            posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                modal_type: MODAL_TYPES.RE_CONSENT,
                documents: outdatedDocs.map((d) => d.slug),
            })
            setOutdatedDocs([])
            // a future appearance of this modal (version bump, account switch)
            // must start with an unticked box
            setChecked(false)
        } catch (e) {
            // Sentry (not console): if /accept fails systematically, nobody can
            // record consent at all — that must be visible in prod
            Sentry.captureException(e, { tags: { feature: 're-consent', action: 'accept' } })
            setError('Could not save your acceptance — please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    /** "Not now", the close button, backdrop and Escape all land here. */
    const handlePostpone = () => {
        if (submitting) return
        const userId = user?.user.userId
        // defer to the date these documents actually take effect (§17.2), not a
        // fixed interval — a doc posted today buys the user its full 30 days
        if (userId)
            snoozeReConsent(
                userId,
                outdatedDocs.map((d) => d.currentVersion)
            )
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, {
            modal_type: MODAL_TYPES.RE_CONSENT,
            documents: outdatedDocs.map((d) => d.slug),
        })
        setOutdatedDocs([])
        setChecked(false)
        setError(null)
    }

    if (!outdatedDocs.length) return null

    return (
        <ActionModal
            visible
            onClose={handlePostpone}
            icon="info"
            title={t('reConsent.title')}
            content={
                // no text-left: modal body is centered per the modal board
                <div className="space-y-3 w-full">
                    {/* The first sentence answers the question this modal actually raises
                     * ("is something being taken from me?") before anything else. The
                     * what-changed line describes the 2026-07-15 tos-v1 rewrite — revisit
                     * it when a future version bump shows this modal for a different
                     * change. "No rush" is literal: "Not now" snoozes to the effective
                     * date (see utils.ts). */}
                    <p className="text-body-s text-foreground-secondary">{t('reConsent.reassurance')}</p>
                    <p className="text-body-s text-foreground-secondary">{t('reConsent.whatChanged')}</p>
                    <ul className="space-y-1 text-body-s">
                        {outdatedDocs.map((doc) => {
                            const label = DOC_LABELS[doc.slug] ?? { name: doc.slug, href: `/${doc.slug}` }
                            return (
                                <li key={doc.slug}>
                                    <DocsLink href={label.href} className="text-foreground-primary underline">
                                        {label.name}
                                    </DocsLink>
                                </li>
                            )
                        })}
                    </ul>
                    {error && <p className="text-body-s text-foreground-error">{error}</p>}
                </div>
            }
            checkbox={{
                text: 'I accept the updated documents',
                checked,
                onChange: setChecked,
            }}
            ctas={[
                {
                    text: submitting ? 'Saving…' : 'Accept & continue',
                    variant: 'purple',
                    shadowSize: '4',
                    disabled: !checked || submitting,
                    onClick: handleAccept,
                    // ActionModal's sm:flex-1 (meant for its side-by-side layout)
                    // squashes h-13 buttons when the CTAs are stacked
                    className: 'sm:flex-none',
                },
                {
                    text: 'Not now',
                    variant: 'stroke',
                    disabled: submitting,
                    onClick: handlePostpone,
                    className: 'sm:flex-none',
                },
            ]}
            ctaClassName={STACKED_CTAS}
        />
    )
}

export default ReConsentModal
