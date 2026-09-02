'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { LOCALE_LABELS } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import InviteFriendsModal from '../Global/InviteFriendsModal'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import Image from 'next/image'
import { useQueryState } from 'nuqs'
import { AvatarPicker } from '@/components/Avatar/AvatarPicker'
import { AVATAR_PICKER_PARAM, avatarPickerParser } from '@/components/Avatar/avatar.consts'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    // URL state so the badge-earned toast can deep-link straight into the picker
    const [avatarPickerOpen, setAvatarPickerOpen] = useQueryState(AVATAR_PICKER_PARAM, avatarPickerParser)
    const router = useRouter()
    const onBack = useSafeBack('/home')
    // Profile "verified" reflects identity verification only (the human was ID-verified) — NOT
    // rail approval. Switched from `useCapabilities().isKycApproved` (any enabled rail, including
    // Rain) to the provider-blind identityVerification projection, which today mirrors Sumsub
    // applicant state. Bridge/Manteca rail approval does NOT flip this badge.
    const { isVerified: isUserSumsubKycApproved } = useIdentityVerification()
    const { hasCardAccess, isEligible } = useCardInfo()
    const residenceRestrictions = useResidenceRestrictions()
    // Card holders always see their card row; for everyone else the promo row
    // only makes sense when the card is actually attainable — a restricted
    // residence or a server "not eligible" hides it instead of advertising a
    // closed door. Unknown (still loading) keeps the row: the /shhhhh
    // explainer is a safe landing either way.
    const showCardMenuItem = hasCardAccess || (!residenceRestrictions.card && isEligible !== false)
    const t = useAppTranslations('profile')
    const { locale } = useAppLocale()

    const logout = async () => {
        await logoutUser()
    }

    const username = user?.user.username || 'anonymous'
    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const displayName = user?.user.showFullName && user?.user.fullName ? user.user.fullName : username

    return (
        <div className="h-full w-full bg-background">
            <NavHeader hideLabel showLogoutBtn onPrev={onBack} />
            <div className="space-y-8">
                <ProfileHeader
                    name={displayName}
                    username={username}
                    isVerified={isUserSumsubKycApproved}
                    onChangeAvatar={() => setAvatarPickerOpen(true)}
                />
                <AvatarPicker open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen} />
                <div className="space-y-4">
                    {/* IA from #2834: identity/products first, then social +
                        account, then app settings. Payment limits moved inline
                        into Unlock payments; name visibility moved to
                        /profile/edit. */}
                    <ListGroup>
                        <ProfileMenuItem
                            icon="globe-lock"
                            label={t('menu.unlockedRegions')}
                            href="/profile/identity-verification"
                            // same chip treatment as the card row's "New!" — a
                            // pulsing dot was a second attention language on
                            // one screen.
                            badge={isUserSumsubKycApproved ? undefined : t('menu.unlockBadge')}
                        />
                        {/* Card row shows for everyone eligible. Holders go straight to
                            /card; everyone else lands on /shhhhh — the waitlist/explainer
                            door, the canonical card entry point — whose CTA forwards on to
                            /card post-launch. We deliberately DON'T send non-holders to
                            /card: it notFound()s users without card access. */}
                        {showCardMenuItem && (
                            <ProfileMenuItem
                                icon="credit-card"
                                label={hasCardAccess ? t('menu.yourCard') : t('menu.peanutCard')}
                                href={hasCardAccess ? '/card' : '/shhhhh'}
                                badge={hasCardAccess ? undefined : t('menu.newBadge')}
                            />
                        )}
                        <ProfileMenuItem
                            icon="exchange"
                            label={t('menu.exchangeRatesAndFees')}
                            href="/profile/exchange-rate"
                            iconClassName="size-4"
                        />
                    </ListGroup>

                    <ListGroup>
                        <ProfileMenuItem
                            icon="smile"
                            label={t('menu.inviteFriends')}
                            onClick={() => setIsInviteFriendsModalOpen(true)}
                            href="/dummy" // Dummy link, wont be called
                        />
                        <ProfileMenuItem icon="achievements" label={t('menu.yourBadges')} href="/badges" />
                        <ProfileMenuItem
                            icon={<Image src={STAR_STRAIGHT_ICON} alt={t('menu.starAlt')} width={20} height={20} />}
                            label={t('menu.points')}
                            href="/rewards"
                        />
                        <ProfileMenuItem icon="user" label={t('menu.personalDetails')} href="/profile/edit" />
                    </ListGroup>

                    <ListGroup>
                        <ProfileMenuItem
                            icon="globe"
                            label={t('language')}
                            endText={LOCALE_LABELS[locale]}
                            href="/settings/language"
                        />
                        <ProfileMenuItem
                            icon="upload-cloud"
                            label={t('menu.backup')}
                            href="/profile/backup"
                            onClick={() => router.push('/profile/backup')}
                        />
                        {/* help center is web-only content — DocsLink localizes
                            the path and opens the in-app browser in Capacitor */}
                        <ProfileMenuItem icon="question-mark" label={t('menu.help')} href="/en/help" isDocsLink />
                        <ProfileMenuItem icon="info" label={t('menu.about')} href="/profile/about" />
                        {/* Enable with Account Management project. */}
                        {/* <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            comingSoon
                        /> */}
                    </ListGroup>

                    {/* Logout + Delete account */}
                    <div className="space-y-6 w-full pb-10">
                        <Button
                            loading={isLoggingOut}
                            disabled={isLoggingOut}
                            variant="primary-soft"
                            shadowSize="4"
                            className="w-full"
                            onClick={logout}
                        >
                            <Icon name="logout" size={20} fill="black" />
                            <span className="font-bold">{t('logOut')}</span>
                        </Button>
                    </div>
                </div>
            </div>

            <InviteFriendsModal
                visible={isInviteFriendsModalOpen}
                onClose={() => setIsInviteFriendsModalOpen(false)}
                username={user?.user.username ?? ''}
                source="profile"
            />
        </div>
    )
}
