'use client'

import HandThumbsUpV2 from '@/assets/illustrations/hand-thumbs-up-v2.svg'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import HomeHistory from '@/components/Home/HomeHistory'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import posthog from 'posthog-js'
import ProfileHeader from './ProfileHeader'
import { useState, useEffect, useRef } from 'react'
import { invitesApi } from '@/services/invites'
import { usersApi } from '@/services/users'
import { useRouter } from 'next/navigation'
import { isCapacitor } from '@/utils/capacitor'
import { requestUrl } from '@/utils/native-routes'
import Card from '@/components/Global/Card'
import { toInviteCode } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import ShareButton from '@/components/Global/ShareButton'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import BadgesRow from '@/components/Badges/BadgesRow'
import { stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'

interface PublicProfileProps {
    username: string
    isLoggedIn?: boolean
    onSendClick?: () => void
}

const PublicProfile: React.FC<PublicProfileProps> = ({ username, isLoggedIn = false, onSendClick }) => {
    const t = useTranslations('profile.publicProfile')
    const tNav = useTranslations('navigation')
    const [profileUserId, setProfileUserId] = useState<string | null>(null)
    const [fullName, setFullName] = useState<string>(username)
    const [showFullName, setShowFullName] = useState<boolean>(false)
    const [isKycVerified, setIsKycVerified] = useState<boolean>(false)
    // Keyed by the username it was loaded for: the [...recipient] route reuses
    // this component instance across profiles, and an effect-time reset still
    // lets one render paint the previous owner's avatar beside the new name.
    const [loadedAvatar, setLoadedAvatar] = useState<{ username: string; avatarKey: string | null } | null>(null)
    const avatarKey = loadedAvatar?.username === username ? loadedAvatar.avatarKey : null
    const router = useRouter()
    const goBack = useSafeBack('/home')
    const { user, isFetchingUser } = useAuth()
    const isSelfProfile = user?.user.username?.toLowerCase() === username.toLowerCase()
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [isJoining, setIsJoining] = useState(false)
    const [profileBadges, setProfileBadges] = useState<
        Array<{
            code: string
            name: string
            description: string | null
            publicDescription?: string | null
            iconUrl: string | null
            earnedAt?: string | Date
        }>
    >([])
    // handle send button click
    const handleSend = () => {
        if (onSendClick) {
            onSendClick()
        }
    }

    // migration window: web signup is closed, so the guest CTA has to be able to
    // hand off to the app stores instead of routing into a dead signup.
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        trackImpressionWhenGuest: !isFetchingUser && !isLoggedIn,
    })

    // Gated on isFetchingUser: every visitor looks logged-out during the pre-auth
    // flash. Keyed by username because the [...recipient] route reuses this
    // component instance across profile navigations.
    const referralImpressionForUsername = useRef<string | null>(null)
    useEffect(() => {
        if (isFetchingUser || isLoggedIn || referralImpressionForUsername.current === username) return
        referralImpressionForUsername.current = username
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
    }, [isFetchingUser, isLoggedIn, username])

    // Every public profile is deliberately an invite door (Konrad, Aug 2026) —
    // bare `peanut.me/<username>` links credit their owner retroactively.
    const handleJoinClick = async () => {
        // A tap during the pre-auth flash would write someone else's invite code
        // into an already-authenticated session's cookies.
        if (isFetchingUser || isJoining) return
        setShowInviteModal(false)
        setIsJoining(true)
        const code = toInviteCode(username)
        // Started but NOT awaited: the handoff calls window.open, which iOS blocks
        // in a promise continuation, so it has to run inside the click gesture. It
        // opens `_blank`, so this tab lives on and the cookie write below lands
        // (true store-hop attribution: TASK-21044).
        const validation = invitesApi.validateInviteCode(code)
        const intercepted = interceptGuestCta()
        try {
            const { onboardingResolved, username: inviterUsername } = await validation.catch(() => ({
                onboardingResolved: false,
                username: '',
            }))
            // Credit ONLY the profile owner: the API's typo-fallback resolves a
            // waitlisted handle to a DIFFERENT real user (`maria23` → `maria`).
            // Session scope, no expiryDays — a poisoned cookie outlives this page
            // and locks setup past the only screen with Log In (PR #2346).
            const resolvedToOwner = !!onboardingResolved && inviterUsername === code
            if (resolvedToOwner) stashInvite(code, EInviteType.DIRECT)
            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
                link_type: resolvedToOwner ? 'invite_code' : 'none',
            })
            if (intercepted) return
            // Unresolvable and mismatched codes still navigate — /invite owns the
            // messaging. Native strips /invite; /setup?step=signup is its stand-in
            // (the stash above already carries the code, and ONLY when it
            // resolved to the owner).
            router.push(isCapacitor() ? '/setup?step=signup' : `/invite?code=${code}`)
        } finally {
            setIsJoining(false)
        }
    }

    // One element, two doors — the guest card and the Request-gate modal.
    const joinCtaButton = (
        <Button variant="primary" shadowSize="4" className="w-full" disabled={isJoining} onClick={handleJoinClick}>
            {t('joinCta')}
        </Button>
    )

    useEffect(() => {
        // Ignore a response the next navigation has already superseded.
        let superseded = false
        usersApi.getByUsername(username).then((apiUser) => {
            if (superseded) return
            if (apiUser?.fullName) setFullName(apiUser.fullName)
            // get the profile owner's showFullName preference
            setShowFullName(apiUser?.showFullName ?? false)
            setIsKycVerified(apiUser?.isVerified ?? false)
            setProfileUserId(apiUser?.userId ?? null)
            setProfileBadges(apiUser?.badges ?? [])
            setLoadedAvatar({ username, avatarKey: apiUser?.avatarKey ?? null })
        })
        return () => {
            superseded = true
        }
    }, [username])

    // interaction-status is the complete "sent money before" source (covers send-link
    // claims etc., unlike the profile payload's narrow received-from-you sum); stays
    // false (neutral) until the query resolves.
    const { interactions } = useUserInteractions(isLoggedIn && profileUserId ? [profileUserId] : [])
    const haveSentMoneyToUser = !!profileUserId && (interactions[profileUserId] ?? false)

    // respect profile owner's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const displayName = showFullName && fullName ? fullName : username

    return (
        <div className="flex min-h-inherit w-full flex-col gap-8">
            {/* Logo - Only shown in guest view */}
            <div>
                {!isLoggedIn ? (
                    <div className="flex items-center gap-2">
                        <Image src={PEANUTMAN} alt={t('peanutMascotAlt')} height={24} />
                        <Image src={PEANUT_LOGO_BLACK} alt={t('peanutLogoTextAlt')} height={12} />
                    </div>
                ) : (
                    <NavHeader onPrev={goBack} hideLabel />
                )}
            </div>

            <div className="space-y-8">
                {/* Profile Header - Using the reusable component */}
                <ProfileHeader
                    showShareButton={false}
                    name={displayName}
                    username={username}
                    isVerified={isKycVerified}
                    className="mb-6"
                    haveSentMoneyToUser={haveSentMoneyToUser}
                    avatarKey={avatarKey}
                />

                {/* Action Buttons */}
                {!isSelfProfile && (
                    <div className="flex items-center justify-normal gap-4">
                        <Button
                            onClick={handleSend}
                            variant="primary"
                            shadowSize="4"
                            icon="arrow-up-right"
                            className="w-1/2"
                        >
                            {tNav('send')}
                        </Button>

                        <Button
                            onClick={() => {
                                if (isLoggedIn && user?.user.hasAppAccess) {
                                    router.push(requestUrl(username))
                                } else {
                                    setShowInviteModal(true)
                                }
                            }}
                            variant="primary"
                            shadowSize="4"
                            icon="arrow-down-left"
                            className="w-1/2"
                        >
                            {/* Not navigation.request: that labels the user's OWN
                                Request flow, and es-419 renders it "Recibir" —
                                receiving, which is not what this button does to
                                someone else's profile. */}
                            {t('requestAction')}
                        </Button>
                    </div>
                )}

                {/* badges row */}
                <BadgesRow badges={profileBadges} isSelfProfile={isSelfProfile} />

                {/* Show create account box to guest users */}
                {!isLoggedIn && (
                    <Card position="solo" className="flex flex-col gap-4 p-4 text-center">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-center gap-2">
                                <Image src={HandThumbsUpV2.src} alt={t('joinPeanutAlt')} width={20} height={20} />
                                <h2 className="text-heading-card text-foreground-primary">{t('joinPeanut')}</h2>
                                <Image
                                    src={HandThumbsUpV2.src}
                                    className="scale-x-[-1] transform"
                                    alt={t('joinPeanutAlt')}
                                    width={20}
                                    height={20}
                                />
                            </div>
                            <p>{t('invitedLine', { username })}</p>
                        </div>
                        {joinCtaButton}
                    </Card>
                )}

                {/* Show history to logged in users  */}
                {isLoggedIn && (
                    <div>
                        <HomeHistory username={username} />
                        {isSelfProfile && (
                            <p className="mt-3 mb-1 text-center text-body-s text-foreground-secondary">
                                {t('activityPrivateNote')}
                            </p>
                        )}
                    </div>
                )}

                {storeHandoffModal}

                {/* A logged-out guest gets the crediting door; the beg flow stays for
                    the logged-in-without-access case, where the owner's code can no
                    longer credit them through signup. */}
                <Drawer
                    open={showInviteModal}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) setShowInviteModal(false)
                    }}
                >
                    <DrawerContent>
                        <div className="flex flex-col items-center gap-4 pt-1 pb-6 text-center">
                            <IconBubble icon="user" className="bg-action-primary" />
                            <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                                <DrawerTitle>{t('noInviteTitle')}</DrawerTitle>
                                <DrawerDescription>
                                    {isLoggedIn
                                        ? `${t('inviteOnlyLine1')}\n${t('inviteOnlyLine2')}`
                                        : t('invitedLine', { username })}
                                </DrawerDescription>
                            </DrawerHeader>
                            {isLoggedIn ? (
                                <ShareButton
                                    generateText={() => Promise.resolve(t('begShareText'))}
                                    title={t('begForInvite')}
                                >
                                    {t('begForInvite')}
                                </ShareButton>
                            ) : (
                                joinCtaButton
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    )
}

export default PublicProfile
