'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import ActionModal from '../ActionModal'
import DocsLink from '@/components/Global/DocsLink'
import { useAuth } from '@/context/authContext'
import { acceptedLegalDocument, consentApi, type ConsentStatusDocument } from '@/services/consent'
import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentSlug } from '@/constants/legal-versions.generated'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

const DOC_LABELS: Record<string, { name: string; href: string }> = {
    terms: { name: 'Terms of Service', href: '/terms' },
    privacy: { name: 'Privacy Policy', href: '/privacy' },
    'card-terms-us': { name: 'Card Terms (U.S.)', href: '/card-terms-us' },
    'card-terms-international': { name: 'Card Terms (International)', href: '/card-terms-international' },
    'card-esign': { name: 'E-Sign Consent', href: '/card-esign' },
    'card-privacy': { name: 'Account Opening Privacy Notice', href: '/card-privacy' },
    'card-prohibited-activities': { name: 'Prohibited Activities Policy', href: '/card-prohibited-activities' },
}

/**
 * Re-consent click-through (tos-v1 phase 2, ToS §17): when a legal document's
 * published version moves past what the user last provably accepted, this
 * blocking modal lists the updated documents and appends fresh consent-ledger
 * rows on acceptance. Backed by GET/POST /users/consent — see peanut-api.
 */
const ReConsentModal = () => {
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
                // a failed status check must never lock the app — retry next session
                console.error('[re-consent] failed to load consent status', e)
            })
    }, [user])

    const handleAccept = async () => {
        if (!checked || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            await consentApi.accept(outdatedDocs.map((d) => acceptedLegalDocument(d.slug as LegalDocumentSlug)))
            posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, {
                modal_type: MODAL_TYPES.RE_CONSENT,
                documents: outdatedDocs.map((d) => d.slug),
            })
            setOutdatedDocs([])
            // a future appearance of this modal (version bump, account switch)
            // must start with an unticked box
            setChecked(false)
        } catch (e) {
            console.error('[re-consent] failed to record acceptance', e)
            setError('Could not save your acceptance — please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!outdatedDocs.length) return null

    return (
        <ActionModal
            visible
            onClose={() => undefined}
            preventClose
            hideModalCloseButton
            icon="info"
            title="We've updated our terms"
            content={
                <>
                    <p className="text-sm text-grey-1">
                        To keep using Peanut, please review and accept the updated documents:
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                        {outdatedDocs.map((doc) => {
                            const label = DOC_LABELS[doc.slug] ?? { name: doc.slug, href: `/${doc.slug}` }
                            return (
                                <li key={doc.slug}>
                                    <DocsLink href={label.href} className="underline">
                                        {label.name}
                                    </DocsLink>
                                </li>
                            )
                        })}
                    </ul>
                    {error && <p className="text-sm text-error">{error}</p>}
                </>
            }
            checkbox={{
                text: 'I have read and accept the updated documents',
                checked,
                onChange: setChecked,
            }}
            ctas={[
                {
                    text: submitting ? 'Saving…' : 'Accept & continue',
                    disabled: !checked || submitting,
                    onClick: handleAccept,
                },
            ]}
        />
    )
}

export default ReConsentModal
