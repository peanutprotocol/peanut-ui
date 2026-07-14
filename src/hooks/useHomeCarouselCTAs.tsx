'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import { useCapabilities } from './useCapabilities'
import type { StaticImageData } from 'next/image'
import { useModalsContext } from '@/context/ModalsContext'
import { DeviceType, useDeviceType } from './useGetDeviceType'
import { usePWAStatus } from './usePWAStatus'
import { isCapacitor } from '@/utils/capacitor'
import { useGeoLocation } from './useGeoLocation'
import { useCardInfo } from './useCardInfo'
import { useActivationStatus } from './useActivationStatus'
import { useTransactionHistory } from './useTransactionHistory'
import { STAR_STRAIGHT_ICON } from '@/assets'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useToast } from '@/components/0_Bruddle/Toast'

// Days a dismissed CTA stays hidden before reappearing. Set above 1 so dismiss feels
// "sticky" but below 14 so we still nudge users about valuable actions they haven't
// adopted. Per-CTA cooldowns can come later via the user-signaling unification project.
const DISMISS_COOLDOWN_DAYS = 7
const DISMISS_COOLDOWN_MS = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

export type CarouselCTA = {
    id: string
    title: string | React.ReactNode
    description: string | React.ReactNode
    icon: IconName
    logo?: StaticImageData
    logoSize?: number
    // optional handlers for notification prompt
    onClick?: () => void | Promise<void>
    onClose?: () => void
    iconContainerClassName?: string
    secondaryIcon?: StaticImageData | string
    iconSize?: number
    // perk claim indicator - shows pink dot instead of X close button
    isPerkClaim?: boolean
}

/** Read dismissals from preferences, dropping any whose cooldown has expired.
 *  Returns id → dismissedAt so callers can keep the timestamp around if needed.
 *  Accepts the legacy `string[]` shape (no timestamps) — those entries are
 *  treated as "dismissed now" so existing users get a fresh 7-day window from
 *  the moment they pick up this code, rather than CTAs suddenly reappearing. */
const getDismissedCTAs = (userId: string | undefined): Map<string, Date> => {
    const dismissed = getUserPreferences(userId)?.dismissedCarouselCTAs
    const now = new Date()
    const cutoff = now.getTime() - DISMISS_COOLDOWN_MS

    if (!dismissed) return new Map()

    if (Array.isArray(dismissed)) {
        // Legacy permanent-dismissal shape — coerce to "dismissed now".
        return new Map(dismissed.map((id) => [id, now]))
    }

    const map = new Map<string, Date>()
    for (const [id, iso] of Object.entries(dismissed)) {
        const dismissedAt = new Date(iso)
        if (!Number.isNaN(dismissedAt.getTime()) && dismissedAt.getTime() > cutoff) {
            map.set(id, dismissedAt)
        }
    }
    return map
}

export const useHomeCarouselCTAs = () => {
    const [carouselCTAs, setCarouselCTAs] = useState<CarouselCTA[]>([])
    const { user } = useAuth()
    const dismissedRef = useRef<Map<string, Date>>(new Map())
    const {
        requestPermission,
        afterPermissionAttempt,
        isPermissionDenied,
        isPermissionGranted,
        isPushOptedIn,
        oneSignalInitialized,
    } = useNotifications()
    const toast = useToast()
    const router = useRouter()
    const { canDo, rails, bankRails } = useCapabilities()
    // Suppress the "verify your account" CTA when the user is already mid-flow
    // on ANY rail (`pending` = submitted/provisioning, `requires-info` = finish
    // tos/proof). Includes pool-tier Manteca + QR-only rails, not just bank —
    // the user shouldn't be re-nudged regardless of channel.
    const isInFlight = rails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info')
    const { deviceType } = useDeviceType()
    const isPwa = usePWAStatus()
    const { setIsIosPwaInstallModalOpen, openSupportWithMessage } = useModalsContext()

    const { setIsQRScannerOpen } = useModalsContext()
    const { countryCode: userCountryCode } = useGeoLocation()
    const {
        isEligible: isCardPioneerEligible,
        hasCardAccess: hasCardAccessGranted,
        isLoading: isCardPioneerLoading,
    } = useCardInfo()
    const { isActivated } = useActivationStatus()

    // Completion signals — used to hide educational CTAs from users who've already
    // done the action. Shares the React Query cache key with HomeHistory below, so
    // this read is free when the home page is mounted.
    const { data: latestHistory } = useTransactionHistory({ mode: 'latest', limit: 50 })
    // `boolean | undefined` (no `?? false`) so the QR-payment CTA gate can
    // distinguish "loaded, none found" from "still loading" — see the strict
    // `=== false` check below.
    const hasMadeQrPayment: boolean | undefined = useMemo(
        () => latestHistory?.entries.some((e) => e.extraData?.kind === 'QR_PAY'),
        [latestHistory]
    )
    const hasSentInvites = (user?.invitesSent?.length ?? 0) > 0
    const hasSupportSurvivorBadge = user?.user?.badges?.some((b) => b.code === 'SUPPORT_SURVIVOR') ?? false

    const dismissCTA = useCallback(
        (ctaId: string) => {
            dismissedRef.current.set(ctaId, new Date())
            const record: Record<string, string> = {}
            for (const [id, dismissedAt] of dismissedRef.current) {
                record[id] = dismissedAt.toISOString()
            }
            updateUserPreferences(user?.user?.userId, { dismissedCarouselCTAs: record })
            setCarouselCTAs((prev) => prev.filter((c) => c.id !== ctaId))
        },
        [user?.user?.userId]
    )

    const generateCarouselCTAs = useCallback(() => {
        const _carouselCTAs: CarouselCTA[] = []

        // Home CTAs gate on "user can do a bank deposit or a pay" — provider-blind.
        // Rain (card) does NOT count; a card-only user must still see the verify CTA.
        const hasKycApproval = bankRails().some((r) => r.status === 'enabled') || canDo('pay')
        const isLatamUser = userCountryCode === 'AR' || userCountryCode === 'BR'

        // Card CTA — Pioneers replaced by free badge-gated waitlist (M2).
        // Show to all users who don't already have card access.
        // Routes via /shhhhh so the user passes the outer gate AND lands on
        // the marketing context for the closed beta. Users with badges that
        // skip the queue will go straight to celebration on /card.
        if (!underMaintenanceConfig.disableCardPioneers && hasCardAccessGranted === false) {
            _carouselCTAs.push({
                id: 'card-pioneer',
                title: (
                    <span>
                        Get your <b>Peanut Card</b>
                    </span>
                ),
                description: (
                    <span>
                        Closed beta. <b>Badges skip the line.</b> $10 unlocks on your first $100 spend.
                    </span>
                ),
                iconContainerClassName: 'bg-purple-1',
                icon: 'credit-card',
                onClick: () => {
                    router.push('/shhhhh')
                },
                iconSize: 16,
            })
        }

        // Generic invite CTA for non-LATAM activated users who haven't invited yet.
        if (!isLatamUser && isActivated && !hasSentInvites) {
            _carouselCTAs.push({
                id: 'invite-friends',
                title: 'Invite friends. Earn rewards',
                description: 'Earn rewards every time your friends use Peanut.',
                icon: 'invite-heart',
                logo: STAR_STRAIGHT_ICON,
                logoSize: 30,
                onClick: () => {
                    router.push('/rewards')
                },
            })
        }
        // Brave Shields blocks the OneSignal SDK; requestPermission no-ops
        // until init succeeds, so don't render a click-to-no-op CTA.
        if (oneSignalInitialized && !isPermissionGranted && !isPushOptedIn && (isPwa || isCapacitor())) {
            _carouselCTAs.push({
                id: 'notification-prompt',
                title: 'Stay in the loop!',
                description: 'Turn on notifications and get alerts for all your wallet activity.',
                icon: 'bell',
                onClick: async () => {
                    // On the web PWA a denied browser permission can't be re-prompted —
                    // the user must reinstall — so route to the install modal. On native
                    // the OS prompt falls back to the Settings app (handled in requestPermission),
                    // so let it through instead of showing a PWA-install dead end.
                    if (isPermissionDenied && !isCapacitor()) {
                        setIsIosPwaInstallModalOpen(true)
                        return
                    }
                    const result = await requestPermission()
                    await afterPermissionAttempt()
                    // 'default' = browser suppressed prompt (policy/Shields) or
                    // user dismissed it — calling again won't help this session.
                    if (result === 'default') {
                        toast.warning('Notifications blocked by your browser. Enable them in site settings and reload.')
                        dismissCTA('notification-prompt')
                    }
                },
            })
        }

        if (deviceType === DeviceType.IOS && !isPwa && !isCapacitor()) {
            _carouselCTAs.push({
                id: 'ios-pwa-install',
                title: 'Add Peanut to your home screen',
                description: 'Follow a quick guide to add the app to your home screen, no download needed.',
                iconContainerClassName: 'bg-secondary-1',
                icon: 'mobile-install',
                onClick: () => {
                    setIsIosPwaInstallModalOpen(true)
                },
                iconSize: 16,
            })
        }

        // Strict `=== false` gates on "history loaded, no QR pay" — `undefined`
        // (still loading) keeps the CTA hidden so it doesn't flash in then out.
        if (hasKycApproval && hasMadeQrPayment === false) {
            _carouselCTAs.push({
                id: 'qr-payment',
                title: (
                    <span>
                        Pay with <b>QR code payments</b>
                    </span>
                ),
                description: (
                    <span>
                        Get the best exchange rate, pay like a <b>local</b> and earn <b>rewards</b>.
                    </span>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'qr-code',
                onClick: () => {
                    setIsQRScannerOpen(true)
                },
                iconSize: 16,
            })
        }

        // ------------------------------------------------------------------------------------------------
        // LATAM rewards CTA - show to activated users in Argentina or Brazil who haven't
        // invited anyone yet. Encourages first-invite; we hide once they've sent at least one.
        if (isLatamUser && isActivated && !hasSentInvites) {
            _carouselCTAs.push({
                id: 'latam-cashback-invite',
                title: (
                    <span>
                        Earn <b>rewards</b> on QR payments
                    </span>
                ),
                description: (
                    <span>
                        Invite friends to <b>earn more rewards</b>. The more they use, the more you earn!
                    </span>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'gift',
                onClick: () => {
                    router.push('/rewards')
                },
                iconSize: 16,
            })
        }

        // Bug bounty — shown to activated users who haven't already claimed.
        // Server enforces lifetime cap of 1 grant per user, so re-pinging the
        // CTA after a successful claim would just bounce off `already_granted`.
        // Hide once the SUPPORT_SURVIVOR badge is on the user — that's the
        // server-side dedup marker, so it's the authoritative signal.
        if (isActivated && !hasSupportSurvivorBadge) {
            _carouselCTAs.push({
                id: 'bug-bounty',
                title: (
                    <span>
                        Help us improve and <b>get $5!</b>
                    </span>
                ),
                description: 'Report a bug. Get rewarded! No questions asked.',
                iconContainerClassName: 'bg-primary-1',
                icon: 'bug',
                iconSize: 20,
                // (mobile-ui) routes don't load the Crisp script directly —
                // the chat lives inside SupportDrawer's iframe. Use the
                // ModalsContext helper instead of `window.$crisp.push(...)`,
                // which only works on (marketing) routes.
                onClick: () => openSupportWithMessage('I found a bug: '),
            })
        }

        // Don't push card-eligible users (skip badge / admin grant) to the
        // region picker. This CTA routes to /profile/identity-verification,
        // where EU/NA users get `bridge-requirements` + Bridge bank rails — the
        // detour we steer eligible users away from (they go to /card instead,
        // which KYCs on `rain-requirements`). `=== false` so we suppress while
        // card-info is still loading too, mirroring the card-pioneer gate above.
        if (!hasKycApproval && !isInFlight && hasCardAccessGranted === false) {
            _carouselCTAs.push({
                id: 'kyc-prompt',
                title: (
                    <span>
                        Unlock <b>QR code payments</b>
                    </span>
                ),
                description: (
                    <span>
                        Confirm your ID to pay with <b>Mercado Pago</b> and <b>PIX</b> QR codes
                    </span>
                ),
                iconContainerClassName: 'bg-secondary-1',
                icon: 'qr-code',
                iconSize: 16,
                onClick: () => {
                    router.push('/profile/identity-verification')
                },
            })
        }

        setCarouselCTAs(_carouselCTAs.filter((cta) => !dismissedRef.current.has(cta.id)))
    }, [
        user?.user?.userId,
        isPermissionGranted,
        isPermissionDenied,
        isPushOptedIn,
        canDo,
        bankRails,
        isInFlight,
        router,
        requestPermission,
        afterPermissionAttempt,
        setIsQRScannerOpen,
        deviceType,
        isPwa,
        userCountryCode,
        isCardPioneerEligible,
        hasCardAccessGranted,
        isCardPioneerLoading,
        isActivated,
        hasMadeQrPayment,
        hasSentInvites,
        hasSupportSurvivorBadge,
        oneSignalInitialized,
        setIsIosPwaInstallModalOpen,
        toast,
        dismissCTA,
        openSupportWithMessage,
    ])

    useEffect(() => {
        if (!user) {
            setCarouselCTAs([])
            dismissedRef.current = new Map()
            return
        }

        dismissedRef.current = getDismissedCTAs(user.user.userId)
        generateCarouselCTAs()
    }, [user, generateCarouselCTAs, isPermissionGranted])

    return { carouselCTAs, dismissCTA }
}
