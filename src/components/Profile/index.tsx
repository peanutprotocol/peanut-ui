'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LOCALE_LABELS } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/AppIntlProvider'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useCardInfo } from '@/hooks/useCardInfo'
import Card from '../Global/Card'
import DeleteAccountButton from '@/components/Settings/DeleteAccountButton'
import ShowNameToggle from './components/ShowNameToggle'
import InviteFriendsModal from '../Global/InviteFriendsModal'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import Image from 'next/image'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    const router = useRouter()
    const onBack = useSafeBack('/home')
    // Profile "verified" reflects identity verification only (the human was ID-verified) — NOT
    // rail approval. Switched from `useCapabilities().isKycApproved` (any enabled rail, including
    // Rain) to the provider-blind identityVerification projection, which today mirrors Sumsub
    // applicant state. Bridge/Manteca rail approval does NOT flip this badge.
    const { isVerified: isUserSumsubKycApproved } = useIdentityVerification()
    const { hasCardAccess } = useCardInfo()
    const t = useTranslations('profile')
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
                <ProfileHeader name={displayName} username={username} isVerified={isUserSumsubKycApproved} />
                <div className="space-y-4">
                    <ProfileMenuItem
                        icon="smile"
                        label={t('menu.inviteFriends')}
                        onClick={() => setIsInviteFriendsModalOpen(true)}
                        href="/dummy" // Dummy link, wont be called
                        position="single"
                    />
                    {/* Menu Items - First Group */}
                    <div>
                        {/* Card row shows for everyone. Holders go straight to /card;
                            everyone else lands on /shhhhh — the waitlist/explainer door,
                            the canonical card entry point — whose CTA forwards on to /card
                            post-launch. We deliberately DON'T send non-holders to /card:
                            it notFound()s users without card access. `hasCardAccess` is
                            undefined while useCardInfo loads, falling to the /shhhhh path —
                            the safe default (never 404s; the gated /card route would). */}
                        <ProfileMenuItem
                            icon="credit-card"
                            label={hasCardAccess ? t('menu.yourCard') : t('menu.peanutCard')}
                            href={hasCardAccess ? '/card' : '/shhhhh'}
                            badge={hasCardAccess ? undefined : t('menu.newBadge')}
                            position="first"
                        />
                        <ProfileMenuItem
                            icon="achievements"
                            label={t('menu.yourBadges')}
                            href="/badges"
                            position="middle"
                        />
                        <ProfileMenuItem
                            icon={<Image src={STAR_STRAIGHT_ICON} alt={t('menu.starAlt')} width={20} height={20} />}
                            label={t('menu.points')}
                            href="/rewards"
                            position="last"
                        />
                    </div>
                    <div>
                        <ProfileMenuItem
                            icon="user"
                            label={t('menu.personalDetails')}
                            href="/profile/edit"
                            position="first"
                        />

                        <ProfileMenuItem
                            icon="globe-lock"
                            label={t('menu.unlockedRegions')}
                            href="/profile/identity-verification"
                            position="middle"
                            highlight={!isUserSumsubKycApproved}
                        />

                        <ProfileMenuItem
                            icon="meter"
                            label={t('menu.paymentLimits')}
                            href="/limits"
                            position="middle"
                        />

                        <ProfileMenuItem
                            icon="globe"
                            label={t('language')}
                            endText={LOCALE_LABELS[locale]}
                            href="/settings/language"
                            position="middle"
                        />

                        <Card className="p-4" position="middle">
                            <div className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2">
                                    <Icon name={'eye'} size={20} fill="black" />
                                    <span className="text-base font-medium">{t('menu.showMyFullName')}</span>
                                </div>

                                <div className="flex items-center">
                                    <ShowNameToggle />
                                </div>
                            </div>
                        </Card>
                        <ProfileMenuItem
                            icon="upload-cloud"
                            label={t('menu.backup')}
                            href="/profile/backup"
                            onClick={() => router.push('/profile/backup')}
                            position="last"
                        />
                        {/* Enable with Account Management project. */}
                        {/* <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            position="middle"
                            comingSoon
                        /> */}
                    </div>
                    {/* Menu Items - Second Group */}
                    <ProfileMenuItem
                        icon="exchange"
                        label={t('menu.exchangeRatesAndFees')}
                        href="/profile/exchange-rate"
                        position="single"
                        iconClassName="size-4"
                    />
                    {/* Logout + Delete account */}
                    <div className="w-full space-y-6 pb-10">
                        <Button
                            loading={isLoggingOut}
                            disabled={isLoggingOut}
                            variant="primary-soft"
                            shadowSize="4"
                            className="flex w-full items-center justify-center gap-2 rounded-sm py-3"
                            onClick={logout}
                        >
                            <Icon name="logout" size={20} fill="black" />
                            <span className="font-bold">{t('logOut')}</span>
                        </Button>
                        <DeleteAccountButton />
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
