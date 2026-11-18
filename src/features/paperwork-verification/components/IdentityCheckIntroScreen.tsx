'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import { ProviderRow } from '@/components/Provider/ProviderRow'
import { VerifyStartIntro } from '@/components/Setup/redesign/VerifyStart/VerifyStartIntro'
import { useBackHandler } from '@/hooks/useBackHandler'
import type { ProviderId, ProviderLabel } from '@/types/provider.types'
import { useKycControl } from '../analytics'

/**
 * Verify start, the one verify intro, in front of today's ID check (InitiateKycModal's unlock offer, the Payment
 * methods rows, the card's first check): full screen, and Verify now starts the check the caller always started.
 * It reads nothing from the API, so it works for every user the server keeps on today's flow.
 *
 * Over the page and under the drawers (z-30), so the provider's (?) sheet opens on top of it. The provider row
 * stays because Brazil's Resolution 520 wants every ID screen to name the provider (TASK-23295).
 */
export function IdentityCheckIntroScreen({
    visible,
    hasQuestions,
    providerId,
    providerLabel = 'accountProvider',
    busy = false,
    continueTestId,
    onBack,
    onContinue,
}: {
    visible: boolean
    /** the check asks questions of its own: the tax ID and the regulatory ones in Argentina and Brazil, the card's */
    hasQuestions: boolean
    providerId?: ProviderId | null
    /** what the row calls the provider: the account's, or the card's issuer */
    providerLabel?: ProviderLabel
    busy?: boolean
    continueTestId?: string
    onBack: () => void
    onContinue: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const control = useKycControl('id-handoff', 'kyc_legacy')
    const layerRef = useRef<HTMLDivElement>(null)
    const leave = () => {
        if (!busy) onBack()
    }
    useBackHandler(() => {
        leave()
        return true
    }, visible)
    useEffect(() => {
        if (visible) layerRef.current?.focus()
    }, [visible])

    if (!visible || typeof document === 'undefined') return null
    return createPortal(
        <div
            ref={layerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('steps.title')}
            tabIndex={-1}
            className="fixed inset-0 z-30 overflow-y-auto bg-background-default pb-safe-bottom outline-none"
            data-testid="identity-check-intro"
        >
            {/* the status-bar strip in the band's pink: the shell sets the ground */}
            <div aria-hidden className="setup-hero-background h-safe-top" />
            <VerifyStartIntro
                controlScreen="id-handoff"
                controlFlow="kyc_legacy"
                questions={hasQuestions}
                card={providerLabel === 'cardProvider'}
                starting={busy}
                verifyTestId={continueTestId ?? 'verify-steps-continue'}
                aside={
                    providerId ? (
                        <Card position="solo" className="px-4 py-0">
                            <ProviderRow
                                providerId={providerId}
                                label={providerLabel}
                                prospective
                                onOpenChange={(open) => control.track('provider_help', open ? 'open' : 'dismiss')}
                                onDocumentClick={(document) => control.track(`provider_${document}`, 'tap')}
                            />
                        </Card>
                    ) : undefined
                }
                onLater={leave}
                onVerify={onContinue}
            />
        </div>,
        document.body
    )
}
