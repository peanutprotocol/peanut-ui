'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { Fragment } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import DocsLink from '@/components/Global/DocsLink'
import { Notification } from '@/components/0_Bruddle/Notification'
import { legalPolicyForSlug } from '@/constants/legal-policies'
import { useAuth } from '@/context/authContext'
import { acceptedLegalDocument, consentApi, type ConsentStatusDocument } from '@/services/consent'
import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentSlug } from '@/constants/legal-versions.generated'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { isReConsentSnoozed, snoozeReConsent } from './utils'

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
    const tPolicies = useTranslations('profile.about.policies')
    const { user } = useAuth()
    const [outdatedDocs, setOutdatedDocs] = useState<ConsentStatusDocument[]>([])
    const [checked, setChecked] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(false)
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
        setError(false)
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
        setError(false)
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
            setError(true)
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
        setError(false)
    }

    if (!outdatedDocs.length) return null

    return (
        <Drawer
            open
            onOpenChange={(isOpen) => {
                if (!isOpen) handlePostpone()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="info" color="blue" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('reConsent.title')}</DrawerTitle>
                            {/* The first sentence answers the question this prompt actually raises
                                ("is something being taken from me?") before anything else. The
                                what-changed line describes the 2026-07-15 tos-v1 rewrite — revisit
                                it when a future version bump shows this prompt for a different
                                change. "No rush" is literal: "Not now" snoozes to the effective
                                date (see utils.ts). */}
                            <DrawerDescription className="space-y-3">
                                <span className="block">{t('reConsent.reassurance')}</span>
                                <span className="block">{t('reConsent.whatChanged')}</span>
                            </DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {/* the updated documents on one centered line, separator-joined
                            (wraps when it must) — inline-link treatment per the Signup
                            consent line; DocsLink handles web/PWA/native targets */}
                        <p className="text-body-s">
                            {outdatedDocs.map((doc, index) => {
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
                        {error && <Notification priority="error">{t('reConsent.saveError')}</Notification>}
                        <Checkbox
                            label={t('reConsent.acceptLabel')}
                            value={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                        />
                        {/* "Not now" stacked BELOW the primary CTA — side-by-side
                            would read as two equally-weighted choices */}
                        <Button
                            variant="purple"
                            shadowSize="4"
                            disabled={!checked || submitting}
                            className="w-full justify-center"
                            onClick={handleAccept}
                        >
                            {submitting ? t('reConsent.saving') : t('reConsent.acceptCta')}
                        </Button>
                        <Button
                            variant="stroke"
                            disabled={submitting}
                            className="w-full justify-center"
                            onClick={handlePostpone}
                        >
                            {t('reConsent.notNow')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default ReConsentModal
