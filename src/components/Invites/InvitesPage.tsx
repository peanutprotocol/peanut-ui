'use client'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Loading from '../Global/Loading'
import ValidationErrorView from '../Payment/Views/Error.validation.view'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from '@/utils/tw'
import { Button } from '@/components/0_Bruddle/Button'
import { PeanutWavingHello } from '@/assets/mascot'
import { useRouter, useSearchParams } from 'next/navigation'
import { invitesApi } from '@/services/invites'
import { useQuery } from '@tanstack/react-query'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import { getValidRedirectUrl, saveRedirectUrl, saveToCookie } from '@/utils/general.utils'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { useLogin } from '@/hooks/useLogin'
import { useToast } from '@/components/0_Bruddle/Toast'
import UnsupportedBrowserModal from '../Global/UnsupportedBrowserModal'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { profileUrl } from '@/utils/native-routes'
import { captureException } from '@sentry/nextjs'
import {
    badgeCampaignsFromSearchParams,
    queuePendingBadgeCampaigns,
    sanitizeBadgeCampaignIdentities,
} from './badge-campaign-context'
import {
    claimAndSettlePendingBadgeCampaigns,
    isConfirmedBadgeCampaignClaim,
    isUnavailableBadgeCampaignClaim,
} from '@/services/badge-campaigns'
import { getPasskeyErrorSetupKey } from '@/utils/webauthn.utils'

function InvitePageContent() {
    const t = useTranslations('invites')
    const tSetup = useTranslations('setup')
    const toast = useToast()
    const searchParams = useSearchParams()
    // trim trailing '?' from invite code to handle qr codes with ? at the end
    const inviteCode = searchParams.get('code')?.toLowerCase().replace(/\?+$/, '')
    const redirectUri = searchParams.get('redirect_uri')
    const safeRedirectUri = redirectUri ? getValidRedirectUrl(redirectUri, '') : ''
    const { user, isFetchingUser, fetchUser } = useAuth()

    // Badge campaign identities are opaque and backend-owned. The canonical
    // namespace wins over legacy/UTM transports; inviter `code` is unrelated.
    const urlBadgeCampaigns = useMemo(() => badgeCampaignsFromSearchParams(searchParams), [searchParams])
    const hasUrlBadgeCampaigns = urlBadgeCampaigns.length > 0

    const dispatch = useAppDispatch()
    const router = useRouter()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const [isClaimingBadgeCampaigns, setIsClaimingBadgeCampaigns] = useState(false)
    const hasStartedBadgeClaimingRef = useRef(false)

    // Track if we should show content (prevents flash)
    const [shouldShowContent, setShouldShowContent] = useState(false)

    const {
        data: inviteCodeData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['validateInviteCode', inviteCode],
        queryFn: () => invitesApi.validateInviteCode(inviteCode!),
        enabled: !!inviteCode,
    })

    // A published code-only compatibility path may carry backend-owned
    // acquisition metadata. Combining that typed descriptor with explicit URL
    // identities is not code inference: the browser forwards both opaque tags
    // to the same canonical claim endpoint.
    const legacyAcquisition = inviteCodeData?.legacyAcquisition
    const acquisitionBadgeCampaigns = useMemo(
        () =>
            sanitizeBadgeCampaignIdentities([
                ...urlBadgeCampaigns,
                ...(legacyAcquisition ? [legacyAcquisition.campaignTag] : []),
            ]),
        [urlBadgeCampaigns, legacyAcquisition]
    )
    const hasAcquisitionBadgeCampaigns = acquisitionBadgeCampaigns.length > 0

    // Invalid invite code (only reachable when an invite code was supplied).
    // A badge-campaign-only link has no inviter to validate. When a code is present,
    // it must validate independently; badge campaigns never make a bad inviter valid.
    const hasValidInvite = !!inviteCode && !!inviteCodeData?.onboardingResolved && !!inviteCodeData.username
    const isDeadBareLink = !inviteCode && !hasUrlBadgeCampaigns
    const showsInvalidInvite =
        !!inviteCode && !hasUrlBadgeCampaigns && !legacyAcquisition && (isError || !hasValidInvite)

    // migration window: guest CTAs hand off to the stores like the other guest
    // entry points (claim/request/pay). impression fires only when the CTA
    // actually renders — never on the pre-auth flash, the invalid-invite error
    // view, or the dead-bare-link redirect.
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        trackImpressionWhenGuest: shouldShowContent && !user?.user && !isDeadBareLink && !showsInvalidInvite,
    })

    // track invite page view (ref guard prevents duplicate fires when shouldShowContent toggles)
    const hasTrackedPageView = useRef(false)
    useEffect(() => {
        if (shouldShowContent && inviteCodeData?.onboardingResolved && !hasTrackedPageView.current) {
            hasTrackedPageView.current = true
            posthog.capture(ANALYTICS_EVENTS.INVITE_PAGE_VIEWED, {
                invite_code: inviteCode,
                inviter_username: inviteCodeData.username,
            })
        }
    }, [shouldShowContent, inviteCodeData, inviteCode])

    // determine if we should show content based on user state
    useEffect(() => {
        if (isFetchingUser) {
            setShouldShowContent(false)
            return
        }
        // wait for the invite query if there is one
        if (inviteCode && isLoading) {
            setShouldShowContent(false)
            return
        }
        // A logged-in visitor on either claim path will be auto-routed by the
        // effect below — keep the loading spinner so they don't see the CTA flash.
        const canClaimBadgeCampaign = hasAcquisitionBadgeCampaigns
        if (
            user?.user &&
            (canClaimBadgeCampaign || (!redirectUri && user.user.hasAppAccess && inviteCodeData?.onboardingResolved))
        ) {
            setShouldShowContent(false)
            return
        }
        setShouldShowContent(true)
    }, [user, isFetchingUser, redirectUri, inviteCodeData, isLoading, hasAcquisitionBadgeCampaigns, inviteCode])

    // Logged-in auto-claim. Inviter attribution and badge acquisition are
    // independent inputs: a bad inviter is ignored without blocking a valid
    // badge campaign, and a badge campaign never makes a bad inviter valid.
    useEffect(() => {
        if (!user?.user || isFetchingUser || hasStartedBadgeClaimingRef.current) return
        // wait for invite-code validation when there is one
        if (inviteCode && (isLoading || !inviteCodeData)) return

        const hasValidInvite = !!inviteCodeData?.onboardingResolved && !!inviteCodeData.username
        const isInviteAutoClaim = !redirectUri && user.user.hasAppAccess && hasValidInvite
        const canClaimBadgeCampaign = hasAcquisitionBadgeCampaigns
        if (!isInviteAutoClaim && !canClaimBadgeCampaign) return

        hasStartedBadgeClaimingRef.current = true

        if (canClaimBadgeCampaign) {
            setIsClaimingBadgeCampaigns(true)
            const queuedBadgeCampaigns = queuePendingBadgeCampaigns(acquisitionBadgeCampaigns, 30)
            void claimAndSettlePendingBadgeCampaigns(queuedBadgeCampaigns)
                .then(async (batch) => {
                    const confirmed = batch.claims.filter(isConfirmedBadgeCampaignClaim)
                    if (confirmed.length > 0) {
                        try {
                            await fetchUser()
                        } catch (error) {
                            captureException(error, { tags: { error_type: 'campaign_profile_refresh_failed' } })
                        }
                    }

                    const unavailable = batch.claims.filter(isUnavailableBadgeCampaignClaim)
                    const retryable = batch.pending.length > 0
                    if (unavailable.length > 0) {
                        // Pre-joined into ONE string, matching useZeroDev.ts. Sentry's
                        // console integration serializes each console argument, so an
                        // object holding an array of claims landed in the issue as the
                        // literal "[object Object]" — which campaign and why, the only
                        // two facts worth logging, were both unreadable. Keep the
                        // message constant so Sentry groups these into one issue.
                        console.warn(
                            'Badge campaign unavailable; continuing normally',
                            unavailable.map(({ badgeCampaign, outcome }) => `${badgeCampaign}=${outcome}`).join(', ')
                        )
                    }
                    if (retryable) {
                        captureException(new Error('invite-page campaign claim retained for retry'), {
                            tags: { error_type: 'campaign_claim_retryable' },
                            extra: { pendingCampaigns: batch.pending, claims: batch.claims },
                        })
                    }

                    // A validated caller continuation (notably a pending financial
                    // claim) outranks everything. Bespoke campaign destinations
                    // retired with TASK-21226 — a campaign acquisition lands on
                    // /home, a plain valid invite on the inviter's profile.
                    const destination =
                        safeRedirectUri ||
                        (legacyAcquisition ? '/home' : hasValidInvite ? profileUrl(inviteCodeData!.username!) : '/home')
                    router.push(destination)
                })
                .catch((error) => {
                    captureException(error, { tags: { error_type: 'campaign_claim_unexpected_failure' } })
                    router.push(
                        safeRedirectUri ||
                            (legacyAcquisition
                                ? '/home'
                                : hasValidInvite
                                  ? profileUrl(inviteCodeData!.username!)
                                  : '/home')
                    )
                })
            return
        }

        // No badge campaign on a validated invite → route to inviter profile.
        if (hasValidInvite) {
            router.push(profileUrl(inviteCodeData!.username!))
        }
    }, [
        user,
        inviteCodeData,
        isLoading,
        isFetchingUser,
        router,
        acquisitionBadgeCampaigns,
        hasAcquisitionBadgeCampaigns,
        redirectUri,
        safeRedirectUri,
        fetchUser,
        inviteCode,
        legacyAcquisition,
    ])

    // A bare link that resolves to nothing claimable — unknown ?campaign= value,
    // a stray tracking param swept up by the root-domain redirect, an empty
    // ?code= — gets the landing page, not the invalid-invite error. That screen
    // is reserved for links that actually carried an invite code. Safe from a
    // redirect loop: the root redirect only fires when the params are present,
    // and we replace with a bare '/'.

    const handleClaim = () => {
        posthog.capture(ANALYTICS_EVENTS.INVITE_CLAIM_CLICKED, {
            invite_code: inviteCode,
            campaign_tags: acquisitionBadgeCampaigns,
        })

        const hasBackendLegacyAcceptance = !!inviteCode && !!inviteCodeData?.success && !!legacyAcquisition
        if (hasValidInvite || hasBackendLegacyAcceptance) {
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            // Save to cookie so PWA-install + later signup still see the invite.
            saveToCookie('inviteCode', inviteCode)
        }
        // Explicit URL acquisition survives signup in the shared cookie.
        // Backend legacy acquisition is processed by `/invites/accept`, whose
        // typed claim result is consumed after registration.
        if (hasUrlBadgeCampaigns) queuePendingBadgeCampaigns(urlBadgeCampaigns)

        // during the migration window guests go to the stores, not signup —
        // cookie/queue bookkeeping above still runs so a keep-web signup or
        // post-install link re-tap recovers the invite context.
        if (!user?.user && interceptGuestCta()) {
            // keep the mid-flow destination (e.g. a pending claim) recoverable
            // after the store round-trip, same as handleLoginWithBadgeCampaign
            if (safeRedirectUri) saveRedirectUrl()
            return
        }

        const signupUrl = redirectUri
            ? `/setup?step=signup&redirect_uri=${encodeURIComponent(redirectUri)}`
            : '/setup?step=signup'
        router.push(signupUrl)
    }

    const handleLoginWithBadgeCampaign = () => {
        // Existing-user login does not call `/invites/accept`, so queue both
        // explicit and backend-resolved compatibility acquisition for the
        // authenticated recovery flow.
        if (hasAcquisitionBadgeCampaigns) {
            queuePendingBadgeCampaigns(acquisitionBadgeCampaigns, 30)
            // Return to this acquisition boundary after the passkey ceremony so
            // the authenticated page can settle and present the badge before its
            // normal-app fallback.
            saveRedirectUrl()
        }
        // PasskeyError carries curated copy; without this catch a cancelled
        // passkey prompt becomes an unhandled rejection and a Sentry event.
        // Known codes render the translated catalog copy instead of the
        // error's hardcoded English message.
        handleLoginClick().catch((error: unknown) => {
            const i18nKey = getPasskeyErrorSetupKey(error)
            toast.error(i18nKey ? tSetup(i18nKey) : (error instanceof Error && error.message) || tSetup('loginFailed'))
        })
    }

    useEffect(() => {
        if (isDeadBareLink) router.replace('/')
    }, [isDeadBareLink, router])

    if (isClaimingBadgeCampaigns || !shouldShowContent || isDeadBareLink) {
        return <Loading variant="mascot" coverFullScreen />
    }

    if (showsInvalidInvite) {
        return (
            <div className="my-auto space-y-4 flex h-dvh w-screen flex-col items-center justify-center px-6">
                <ValidationErrorView
                    title={t('invalidCodeTitle')}
                    message={t('invalidCodeMessage')}
                    buttonText={tSetup('waitlist.joinWaitlist')}
                    redirectTo="/setup"
                />
            </div>
        )
    }

    // A bare badge-campaign link is the localized "vanity claim" case: the badge
    // is the reason to sign up, and there is no inviter to name. The FE no longer
    // classifies skip-vs-vanity — the backend owns that — so both collapse here.
    const isBadgeCampaignOnly = hasAcquisitionBadgeCampaigns && !hasValidInvite
    const title = isBadgeCampaignOnly
        ? t('vanityTitle')
        : t('inviterTitle', { username: inviteCodeData?.username ?? '' })
    const description = isBadgeCampaignOnly ? t('vanityDescription') : t('inviterDescription')
    const ctaLabel = isBadgeCampaignOnly ? t('vanityCta') : t('inviterCta')
    const loginLabel = isBadgeCampaignOnly ? t('logIn') : t('alreadyHaveAccount')

    return (
        <InvitesPageLayout image={PeanutWavingHello.src}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-background-default px-6 pt-6 pb-8 md:space-y-4 md:h-dvh md:justify-center',
                    'flex flex-col items-end justify-center gap-6 pt-8'
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    <div className="flex h-full flex-col justify-between gap-4 md:gap-6 md:pt-6">
                        <h1 className="text-heading-xs text-foreground-primary">{title}</h1>
                        <p className="text-body-m">{description}</p>
                        <Button onClick={handleClaim} shadowSize="4">
                            {ctaLabel}
                        </Button>

                        {!user?.user && (
                            <Button
                                disabled={isLoggingIn}
                                loading={isLoggingIn}
                                variant="primary-soft"
                                onClick={handleLoginWithBadgeCampaign}
                                shadowSize="4"
                            >
                                {loginLabel}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {storeHandoffModal}
            <UnsupportedBrowserModal allowClose={false} />
        </InvitesPageLayout>
    )
}

export default function InvitesPage() {
    return (
        <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
            <InvitePageContent />
        </Suspense>
    )
}
