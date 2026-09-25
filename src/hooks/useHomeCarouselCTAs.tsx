'use client'

import { type IconName } from '@/components/Global/Icons/Icon'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNotifications } from './useNotifications'
import { useRouter } from 'next/navigation'
import { useCapabilities } from './useCapabilities'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import type { StaticImageData } from 'next/image'
import { useModalsContext } from '@/context/ModalsContext'
import { DeviceType, useDeviceType } from './useGetDeviceType'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { useGeoLocation } from './useGeoLocation'
import { useCardInfo } from './useCardInfo'
import { useActivationStatus } from './useActivationStatus'
import { useTransactionHistory } from './useTransactionHistory'
import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUTMAN_MOBILE } from '@/assets/mascot'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from './useMigrationFlag'
import { openStore } from '@/utils/migration.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { USER_INTERVIEW_CAL_URL } from '@/constants/general.consts'
import { useFeatureFlags } from './useFeatureFlag'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { QrKycState } from '@/constants/kyc.consts'
import { selectQrKycGate } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
import { useIdentityVerification } from './useIdentityVerification'
import { hideHomeCta, readHiddenHomeCtas, showQrPayCTA, showVerifyCTA } from '@/utils/home-carousel.utils'
import { verifyRowStatus } from '@/utils/activation-step.utils'

export type CarouselCTA = {
    id: string
    title: string | React.ReactNode
    description: string | React.ReactNode
    icon?: IconName
    /** a product concept's CTA: its CONCEPT_ICONS bubble replaces icon + iconContainerClassName */
    concept?: Concept
    logo?: StaticImageData
    logoSize?: number
    mascotPose?: MascotPose
    // optional handlers for notification prompt
    onClick?: () => void | Promise<void>
    onClose?: () => void
    iconContainerClassName?: string
    secondaryIcon?: StaticImageData | string
    iconSize?: number
}

export const useHomeCarouselCTAs = () => {
    const t = useAppTranslations('home.carousel')
    const tMigration = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const flagEnabled = useFeatureFlags()
    // User-interview campaign gate. nonProdBypass: previews/local always show
    // the card for QA; on prod the PostHog `username` release condition decides.
    // No mounted guard needed (cf. useMigrationFlag): the value is only read in
    // generateCarouselCTAs, which runs after mount in an effect.
    const interviewInviteOn = flagEnabled('user-interviews-invite', { nonProdBypass: true })
    const [carouselCTAs, setCarouselCTAs] = useState<CarouselCTA[]>([])
    const { user } = useAuth()
    const dismissedRef = useRef<Map<string, Date>>(new Map())
    const { requestPermission, afterPermissionAttempt, isPermissionGranted, isPushOptedIn, oneSignalInitialized } =
        useNotifications()
    const toast = useToast()
    const router = useRouter()
    const { canDo, rails, channelOf, nextActions } = useCapabilities()
    const { isRegionRestricted, status: identityStatus } = useIdentityVerification()
    // Suppress the "verify your account" CTA when the user is already mid-flow
    // on ANY rail (`pending` = submitted/provisioning, `requires-info` = finish
    // tos/proof). Includes pool-tier Manteca + QR-only rails, not just bank —
    // the user shouldn't be re-nudged regardless of channel.
    const isInFlight = rails.some((rail) => rail.status === 'pending' || rail.status === 'requires-info')
    const { deviceType } = useDeviceType()
    const { openSupportWithMessage, setIsGetAppModalOpen, setIsQRScannerOpen } = useModalsContext()
    const { countryCode: userCountryCode } = useGeoLocation()
    const { isEligible: isCardEligible, cardInfo } = useCardInfo()
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
            hideHomeCta(user?.user?.userId, ctaId)
            setCarouselCTAs((prev) => prev.filter((c) => c.id !== ctaId))
        },
        [user?.user?.userId]
    )

    const generateCarouselCTAs = useCallback(() => {
        const _carouselCTAs: CarouselCTA[] = []
        const b = (chunks: React.ReactNode) => <b>{chunks}</b>

        // User-interview invite (temporary campaign): hand-picked heavy users
        // get asked for a 15-min call with the team. The cohort lives in the PostHog
        // flag's `username` release condition — never in code. Leads the
        // carousel on purpose; it targets a handful of users. Closing it hides
        // it for good (id filter below). Delete this block, the
        // flag, the i18n keys, and the dev/home-ctas preview entry when the
        // campaign ends.
        if (interviewInviteOn) {
            _carouselCTAs.push({
                id: 'user-interview',
                title: t('userInterview.title'),
                description: t('userInterview.description'),
                mascotPose: 'waving-hello',
                // The mascot fills its container, and the shared one is size-8;
                // widen it so the mascot reads at 44px like the other CTA logos.
                iconContainerClassName: 'size-11',
                onClick: async () => {
                    posthog.capture(ANALYTICS_EVENTS.USER_INTERVIEW_CTA_CLICKED)
                    // Await so a native Browser.open failure surfaces in
                    // CarouselCTA's onClick try/catch instead of vanishing.
                    await openExternalUrl(USER_INTERVIEW_CAL_URL)
                },
            })
        }

        // During the native-app cutover, mobile opens the visitor's store and
        // desktop opens the scan-to-download QR.
        if (migrationOn && !isCapacitor()) {
            _carouselCTAs.push({
                id: 'app-install',
                title: tMigration('banner.title'),
                description: tMigration('banner.description'),
                icon: 'mobile-install',
                logo: PEANUTMAN_MOBILE,
                iconSize: 16,
                onClick: () => {
                    if (deviceType === DeviceType.WEB) {
                        setIsGetAppModalOpen(true)
                    } else {
                        openStore(deviceType === DeviceType.ANDROID ? 'android' : 'ios', MIGRATION_SURFACES.HOME_BANNER)
                    }
                },
            })
        }

        const isLatamUser = userCountryCode === 'AR' || userCountryCode === 'BR'

        // Generic invite CTA for non-LATAM activated users who haven't invited yet.
        if (!isLatamUser && isActivated && !hasSentInvites) {
            _carouselCTAs.push({
                id: 'invite-friends',
                title: t('invite.title'),
                description: t('invite.description'),
                concept: 'rewards',
                onClick: () => {
                    router.push('/rewards')
                },
            })
        }
        // Brave Shields blocks the OneSignal SDK; requestPermission no-ops
        // until init succeeds, so don't render a click-to-no-op CTA.
        if (oneSignalInitialized && !isPermissionGranted && !isPushOptedIn && isCapacitor()) {
            _carouselCTAs.push({
                id: 'notification-prompt',
                title: t('notifications.title'),
                description: t('notifications.description'),
                icon: 'bell',
                onClick: async () => {
                    // Native permission recovery opens the operating-system settings
                    // when the user already denied the prompt.
                    const result = await requestPermission()
                    await afterPermissionAttempt()
                    // 'default' = browser suppressed prompt (policy/Shields) or
                    // user dismissed it — calling again won't help this session.
                    if (result === 'default') {
                        toast.attention(t('notifications.blockedToast'))
                        dismissCTA('notification-prompt')
                    }
                },
            })
        }

        // the same gate the QR pay page reads: the slide shows only when a scan would pay
        const qrGate = selectQrKycGate({
            isLoading: false,
            isRegionRestricted,
            canPayManteca: canDo('pay', { provider: 'manteca' }),
            mantecaRails: rails.filter((rail) => rail.provider === 'manteca'),
            nextActions,
        })
        if (showQrPayCTA({ canPayQrNow: qrGate.kycGateState === QrKycState.PROCEED_TO_PAY, hasMadeQrPayment })) {
            _carouselCTAs.push({
                id: 'qr-payment',
                title: <span>{t.rich('qrPay.title', { b })}</span>,
                description: <span>{t.rich('qrPay.description', { b })}</span>,
                concept: 'qrPay',
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
                title: <span>{t.rich('latamInvite.title', { b })}</span>,
                description: <span>{t.rich('latamInvite.description', { b })}</span>,
                concept: 'rewards',
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
                title: <span>{t.rich('bugBounty.title', { b })}</span>,
                description: t('bugBounty.description'),
                iconContainerClassName: 'bg-action-primary',
                icon: 'bug',
                iconSize: 20,
                // (mobile-ui) routes don't load the Crisp script directly —
                // the chat lives inside SupportDrawer's iframe. Use the
                // ModalsContext helper instead of `window.$crisp.push(...)`,
                // which only works on (marketing) routes.
                onClick: () => openSupportWithMessage('I found a bug: '),
            })
        }

        // Public card offer for ACTIVATED users — pre-activation Home is owned
        // by ActivationCTAs (checklist / spend step), which carries its own
        // card arm. Excluded: known prohibited residences, anyone with a card
        // relationship (any card-channel rail: active card or in-flight
        // application), and the same kill switch as every other card prompt.
        const hasCardRelationship = rails.some((rail) => channelOf(rail) === 'card')
        if (
            !underMaintenanceConfig.disableCardPromotion &&
            isActivated === true &&
            cardInfo &&
            !cardInfo.geoProhibited &&
            !hasCardRelationship
        ) {
            _carouselCTAs.push({
                id: 'card-offer',
                title: <span>{t.rich('card.title', { b })}</span>,
                description: <span>{t.rich('card.description', { b })}</span>,
                concept: 'card',
                iconSize: 16,
                onClick: () => {
                    router.push('/card')
                },
            })
        }

        // Same QR-pay gate as the QR slide above: no "unlock" ask where the ID
        // check can never open QR pay (region refused, provider blocked).
        if (
            showVerifyCTA({
                qrGateState: qrGate.kycGateState,
                isIdentityVerified: verifyRowStatus(identityStatus) === 'done',
                isInFlight,
                isCardEligible,
            })
        ) {
            _carouselCTAs.push({
                id: 'kyc-prompt',
                title: <span>{t.rich('kyc.title', { b })}</span>,
                description: <span>{t.rich('kyc.description', { b })}</span>,
                concept: 'qrPay',
                iconSize: 16,
                onClick: () => {
                    router.push('/profile/accounts')
                },
            })
        }

        setCarouselCTAs(_carouselCTAs.filter((cta) => !dismissedRef.current.has(cta.id)))
    }, [
        t,
        isPermissionGranted,
        isPushOptedIn,
        canDo,
        isInFlight,
        router,
        requestPermission,
        afterPermissionAttempt,
        setIsQRScannerOpen,
        deviceType,
        userCountryCode,
        isCardEligible,
        cardInfo,
        rails,
        channelOf,
        nextActions,
        isRegionRestricted,
        identityStatus,
        isActivated,
        hasMadeQrPayment,
        hasSentInvites,
        hasSupportSurvivorBadge,
        oneSignalInitialized,
        toast,
        dismissCTA,
        openSupportWithMessage,
        migrationOn,
        interviewInviteOn,
        tMigration,
        setIsGetAppModalOpen,
    ])

    useEffect(() => {
        if (!user) {
            setCarouselCTAs([])
            dismissedRef.current = new Map()
            return
        }

        dismissedRef.current = readHiddenHomeCtas(user.user.userId)
        generateCarouselCTAs()
    }, [user, generateCarouselCTAs, isPermissionGranted])

    return { carouselCTAs, dismissCTA }
}
