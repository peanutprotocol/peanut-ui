'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { useBridgeHostedVerification } from '@/hooks/useBridgeHostedVerification'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'

/**
 * "What to expect" screen in front of Bridge's hosted verification (Persona).
 * The tap used to hand the user straight to the vendor, which is the one flow
 * where that hurts: it runs at the vendor — the in-app browser sheet on
 * native, a new tab on web — and keeps no partial progress, so anyone who
 * leaves mid-way to find a document loses everything and starts over. It is a page rather than a sheet because the prep is the
 * whole content — a modal that needs scrolling to reach its own CTA reads as
 * an interruption, not as the step it actually is.
 *
 * The CTA calls `start` straight out of the click: the reserved tab depends on
 * that user gesture (see useBridgeHostedVerification).
 *
 * The task DISAPPEARING is the success signal — nothing else reports it. The
 * card this replaced got that for free by unmounting; a route has to act on
 * it, or a returning user sits on a live CTA whose only outcome is a 403.
 */
const IDENTITY_ROUTE = '/profile/identity-verification'

/**
 * Grace given to a task that vanishes with no return behind it. Longer than
 * useUserAutoRefresh's 4s poll on purpose: a shorter window cannot outlast the
 * tick that dropped the task, so it could never see the next one put it back.
 */
const CONFIRM_ABSENCE_MS = 6000

export const AdditionalVerificationView = (): React.JSX.Element => {
    const t = useTranslations('kyc.hostedPrep')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack(IDENTITY_ROUTE)
    const { nextActions, isLoading: isLoadingCapabilities } = useCapabilities()
    const { start, isStarting, error, refreshSeq } = useBridgeHostedVerification()
    const hasHostedTask = nextActions.some((action) => action.kind === 'bridge-hosted')

    const sawHostedTask = useRef(false)

    // Keyed off a LOADED capability set, not off the hook's return-listener: the
    // no-usable-tab branch navigates the current tab away before it can arm
    // that listener, so a user who comes back — by deep link, or by Back —
    // remounts with nothing in memory saying they ever left. `isLoading` is what
    // separates "the task is gone" from "the user query has not landed yet".
    useEffect(() => {
        if (hasHostedTask) {
            sawHostedTask.current = true
            return
        }
        if (isLoadingCapabilities) return
        // Never present while we were here: the screen was opened without a
        // task and has nothing to serve. Nothing to wait for.
        if (!sawHostedTask.current) {
            router.replace(IDENTITY_ROUTE)
            return
        }
        // Present and then gone IS the success signal. Whether to trust it
        // straight away comes down to WHY we are looking at a new capability
        // set: a return from the vendor forced this read, so the absence is the
        // answer we asked for and the user should not sit on a finished screen.
        if (refreshSeq > 0) {
            router.replace(IDENTITY_ROUTE)
            return
        }
        // Nobody came back — the task dropped out of a poll while someone was
        // reading. That can be one bad tick, so wait past the next one and let
        // it put the task back rather than navigating out from under them.
        const timer = setTimeout(() => router.replace(IDENTITY_ROUTE), CONFIRM_ABSENCE_MS)
        return () => clearTimeout(timer)
    }, [isLoadingCapabilities, hasHostedTask, refreshSeq, router])

    return (
        <div className="flex w-full flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />

            <div className="flex flex-col items-center gap-3 text-center">
                <IconBubble icon="user-id" size="l" color="yellow" />
                <p className="text-body-s text-foreground-secondary">{t('description')}</p>
            </div>

            <KycPrepChecklist path="hosted" />

            <div className="flex flex-col gap-3">
                {/* Notification, not a bare <p>: it carries role="alert", so a
                    screen reader hears the failure instead of leaving focus on
                    a CTA that silently did nothing. */}
                {error && (
                    <Notification priority="error" data-testid="hosted-start-error">
                        {error}
                    </Notification>
                )}
                <Button
                    variant="purple"
                    shadowSize="4"
                    icon="check-circle"
                    iconPosition="left"
                    disabled={isStarting}
                    onClick={start}
                >
                    {isStarting ? tCommon('loading') : tPrep('startCta')}
                </Button>
                <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            </div>
        </div>
    )
}
