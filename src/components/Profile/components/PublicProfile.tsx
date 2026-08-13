'use client'

import HandThumbsUpV2 from '@/assets/illustrations/hand-thumbs-up-v2.svg'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import HomeHistory from '@/components/Home/HomeHistory'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import posthog from 'posthog-js'
import ProfileHeader from './ProfileHeader'
import { useState, useEffect, useMemo, useRef } from 'react'
import { invitesApi } from '@/services/invites'
import { usersApi } from '@/services/users'
import { useRouter } from 'next/navigation'
import { requestUrl } from '@/utils/native-routes'
import Card from '@/components/Global/Card'
import { checkIfInternalNavigation, saveToCookie, toInviteCode } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import ShareButton from '@/components/Global/ShareButton'
import ActionModal from '@/components/Global/ActionModal'
import BadgesRow from '@/components/Badges/BadgesRow'

interface PublicProfileProps {
    username: string
    isLoggedIn?: boolean
    onSendClick?: () => void
}

const PublicProfile: React.FC<PublicProfileProps> = ({ username, isLoggedIn = false, onSendClick }) => {
    const t = useTranslations('profile.publicProfile')
    const tNav = useTranslations('navigation')
    const [totalSentByLoggedInUser, setTotalSentByLoggedInUser] = useState<string>('0')
    const [fullName, setFullName] = useState<string>(username)
    const [showFullName, setShowFullName] = useState<boolean>(false)
    const [isKycVerified, setIsKycVerified] = useState<boolean>(false)
    const router = useRouter()
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

    // Referral impression, once per settled-guest profile. Gated on
    // isFetchingUser because every visitor looks logged-out during the
    // pre-auth flash — the store-handoff hook tracks its own migration
    // impression, not this one. Keyed by username (not a boolean): the
    // [...recipient] route reuses this component instance across profile
    // navigations, and a clicks-without-impressions funnel reads as >100% CTR.
    const referralImpressionForUsername = useRef<string | null>(null)
    useEffect(() => {
        if (isFetchingUser || isLoggedIn || referralImpressionForUsername.current === username) return
        referralImpressionForUsername.current = username
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, {
            source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
            link_type: 'invite_code',
        })
    }, [isFetchingUser, isLoggedIn, username])

    // Every public profile is deliberately an invite door — bare
    // `peanut.me/<username>` links credit their owner retroactively. Intentional
    // design (Konrad, Aug 2026), not an accident to clean up.
    const handleJoinClick = async () => {
        // Pre-auth flash guard: until auth settles every visitor looks logged
        // out, and a fast tap here would write someone else's invite code into
        // an already-authenticated session's cookies.
        if (isFetchingUser || isJoining) return
        // No-op when the Request-gate modal isn't open; closing here keeps the
        // card door and the modal door on one handler instead of two forks.
        setShowInviteModal(false)
        setIsJoining(true)
        const code = toInviteCode(username)
        // Start the validation but do NOT await it yet — the intercept below has
        // to run inside the click gesture.
        const validation = invitesApi.validateInviteCode(code)
        // Synchronous, first: the store handoff calls window.open, which iOS
        // blocks once it sits in a promise continuation (same fix as
        // PendingVerificationTasks). It opens `_blank`, so THIS tab lives on and
        // the cookie write below still lands. True store-hop attribution
        // (deferred payload in openStore) is TASK-21044.
        const intercepted = interceptGuestCta()
        try {
            const { onboardingResolved, username: inviterUsername } = await validation.catch(() => ({
                onboardingResolved: false,
                username: '',
            }))
            // Credit ONLY when the code resolves to the profile owner themself.
            // The API's typo-fallback can resolve a waitlisted handle to a
            // DIFFERENT real user (profile `maria23` → user `maria`), and that
            // click must never write a cookie — no credit on a mismatch.
            // Session scope, no expiryDays: a poisoned cookie outlives this page,
            // the accept retry upgrades it to 30 days, and setup's skipInviteGate
            // then routes past the only screen with Log In (PR #2346 lockout).
            const resolvedToOwner = !!onboardingResolved && inviterUsername === code
            if (resolvedToOwner) saveToCookie('inviteCode', code)
            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                source: REFERRAL_SOURCES.PUBLIC_PROFILE_GUEST,
                link_type: resolvedToOwner ? 'invite_code' : 'none',
            })
            if (intercepted) return
            // Unresolvable or mismatched codes still navigate — /invite owns the
            // messaging.
            router.push(`/invite?code=${code}`)
        } finally {
            setIsJoining(false)
        }
    }

    // One element, two doors: the guest card and the Request-gate modal must
    // never drift apart — each is a crediting entrance to the same signup.
    const joinCtaButton = (
        <Button variant="purple" shadowSize="4" className="w-full" disabled={isJoining} onClick={handleJoinClick}>
            {t('joinCta')}
        </Button>
    )

    useEffect(() => {
        usersApi.getByUsername(username).then((apiUser) => {
            if (apiUser?.fullName) setFullName(apiUser.fullName)
            // get the profile owner's showFullName preference
            setShowFullName(apiUser?.showFullName ?? false)
            setIsKycVerified(apiUser?.isVerified ?? false)
            // to check if the logged in user has sent money to the profile user,
            // we check the amount that the profile user has received from the logged in user.
            if (apiUser?.totalUsdReceivedFromCurrentUser) {
                setTotalSentByLoggedInUser(apiUser.totalUsdReceivedFromCurrentUser)
            }
            setProfileBadges(apiUser?.badges ?? [])
        })
    }, [username])

    // this flag is true if the current user has sent money to the profile user before.
    const haveSentMoneyToUser = useMemo(() => Number(totalSentByLoggedInUser) > 0, [totalSentByLoggedInUser])

    // respect profile owner's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const displayName = showFullName && fullName ? fullName : username

    return (
        <div className="flex h-full w-full flex-col space-y-4 bg-background">
            {/* Logo - Only shown in guest view */}
            <div>
                {!isLoggedIn ? (
                    <div className="flex items-center gap-2 md:hidden">
                        <Image src={PEANUTMAN} alt={t('peanutMascotAlt')} height={24} />
                        <Image src={PEANUT_LOGO_BLACK} alt={t('peanutLogoTextAlt')} height={12} />
                    </div>
                ) : (
                    <NavHeader
                        onPrev={() => {
                            // Check if the referrer is from the same domain (internal navigation)
                            const isInternalReferrer = checkIfInternalNavigation()

                            if (isInternalReferrer && window.history.length > 1) {
                                router.back()
                            } else {
                                router.push('/home')
                            }
                        }}
                        hideLabel
                    />
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
                />

                {/* Action Buttons */}
                {!isSelfProfile && (
                    <div className="flex items-center justify-normal gap-4">
                        <Button
                            onClick={handleSend}
                            variant="purple"
                            shadowSize="4"
                            className="flex w-1/2 items-center justify-center gap-2 rounded-full py-3"
                        >
                            <Icon name="arrow-up-right" size={18} fill="black" />
                            <span className="font-bold">{tNav('send')}</span>
                        </Button>

                        <Button
                            onClick={() => {
                                if (isLoggedIn && user?.user.hasAppAccess) {
                                    router.push(requestUrl(username))
                                } else {
                                    setShowInviteModal(true)
                                }
                            }}
                            variant="purple"
                            shadowSize="4"
                            className="flex w-1/2 items-center justify-center gap-2 rounded-full py-3"
                        >
                            <Icon name="arrow-down-left" size={18} fill="black" />
                            <span className="font-bold">{tNav('request')}</span>
                        </Button>
                    </div>
                )}

                {/* badges row */}
                <BadgesRow badges={profileBadges} isSelfProfile={isSelfProfile} />

                {/* Show create account box to guest users */}
                {!isLoggedIn && (
                    <div className="flex flex-col items-center">
                        <Card position="single" className="space-y-2 p-4 text-center">
                            {isLoggedIn ? (
                                <>
                                    <h2 className="text-lg font-extrabold">{t('allSetTitle')}</h2>
                                    <p className="mx-auto max-w-[55%] text-sm">{t('allSetDescription')}</p>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-center gap-2">
                                            <Image
                                                src={HandThumbsUpV2.src}
                                                alt={t('joinPeanutAlt')}
                                                width={20}
                                                height={20}
                                            />
                                            <h2 className="text-lg font-extrabold">{t('joinPeanut')}</h2>
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
                                </div>
                            )}
                        </Card>
                        {/* <div
                            className="absolute left-0 top-0 flex w-full justify-center"
                            style={{ transform: 'translateY(-15%)' }}
                        >
                            <div className="relative h-42 w-[65%] md:h-44 md:w-[45%]">
                                <Image
                                    src={chillPeanutAnim.src}
                                    alt="Peanut Mascot"
                                    width={120}
                                    height={120}
                                    className="h-auto w-auto"
                                />
                            </div>
                        </div> */}
                    </div>
                )}

                {/* Show history to logged in users  */}
                {isLoggedIn && (
                    <div>
                        <HomeHistory username={username} />
                        {isSelfProfile && (
                            <div className="mb-1 mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-grey-4/25 px-3 py-2">
                                <Icon name="info" size={16} className="text-grey-1" />
                                <p className="text-center text-sm text-grey-1">{t('activityPrivateNote')}</p>
                            </div>
                        )}
                    </div>
                )}

                {storeHandoffModal}

                {/* Request-gate modal. A logged-out guest gets the same crediting door
                    as the join card above — the beg copy would send them off to ask for
                    the very link this page can hand them. The beg flow stays for the
                    logged-in-without-access case: they already have an account, so the
                    profile owner's code can't credit them through signup. */}
                <ActionModal
                    icon="user"
                    title={t('noInviteTitle')}
                    description={
                        isLoggedIn ? `${t('inviteOnlyLine1')}\n${t('inviteOnlyLine2')}` : t('invitedLine', { username })
                    }
                    visible={showInviteModal}
                    onClose={() => {
                        setShowInviteModal(false)
                    }}
                    content={
                        isLoggedIn ? (
                            <ShareButton
                                generateText={() => Promise.resolve(t('begShareText'))}
                                title={t('begForInvite')}
                            >
                                {t('begForInvite')}
                            </ShareButton>
                        ) : (
                            joinCtaButton
                        )
                    }
                />
            </div>
        </div>
    )
}

export default PublicProfile
