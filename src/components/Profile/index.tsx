'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import { NAV_CIRCLE_BUTTON_CLASSES } from '../Global/NavHeader/navHeader.consts'
import ProfileHeader from './components/ProfileHeader'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { LOCALE_LABELS } from '@/i18n/app/config'
import { useAppLocale } from '@/i18n/app/locale-context'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import Image from 'next/image'
import { useQueryState } from 'nuqs'
import { AVATAR_PICKER_PARAM, avatarPickerParser } from '@/components/Avatar/avatar.consts'
import { useOtaUpdate } from '@/context/OtaUpdateContext'
import dynamic from 'next/dynamic'

const AvatarPicker = dynamic(() => import('@/components/Avatar/AvatarPicker').then((m) => m.AvatarPicker), {
    ssr: false,
})
const InviteFriendsModal = dynamic(() => import('../Global/InviteFriendsModal'), { ssr: false })
const OtaUpdateModal = dynamic(() => import('./components/OtaUpdateModal'), { ssr: false })
const StoreUpdateModal = dynamic(() => import('./components/StoreUpdateModal'), { ssr: false })

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    const [isInviteFriendsModalMounted, setIsInviteFriendsModalMounted] = useState(false)
    const openInviteFriendsModal = () => {
        setIsInviteFriendsModalMounted(true)
        setIsInviteFriendsModalOpen(true)
    }
    // URL state so the badge-earned toast can deep-link straight into the picker
    const [avatarPickerOpen, setAvatarPickerOpen] = useQueryState(AVATAR_PICKER_PARAM, avatarPickerParser)
    // Once mounted, keep the picker alive while its drawer is closed. Its save
    // queue lives in component refs; unmounting here could let an older write
    // race a newer pick after a close/reopen sequence.
    const [avatarPickerMounted, setAvatarPickerMounted] = useState(false)
    useEffect(() => {
        if (avatarPickerOpen) setAvatarPickerMounted(true)
    }, [avatarPickerOpen])
    const router = useRouter()
    const onBack = useSafeBack('/home')
    // Profile "verified" reflects identity verification only (the human was ID-verified) — NOT
    // rail approval. Switched from `useCapabilities().isKycApproved` (any enabled rail, including
    // Rain) to the provider-blind identityVerification projection, which today mirrors Sumsub
    // applicant state. Bridge/Manteca rail approval does NOT flip this badge.
    const { isVerified: isUserSumsubKycApproved } = useIdentityVerification()
    const { showCardSurface: showCardMenuItem, cardHref } = useCardSurfaceAccess()
    const t = useAppTranslations('profile')
    const { locale } = useAppLocale()
    const { pendingBundle, storeUpdateRequired } = useOtaUpdate()
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
    const [isUpdateModalMounted, setIsUpdateModalMounted] = useState(false)
    const [isStoreUpdateModalOpen, setIsStoreUpdateModalOpen] = useState(false)
    const [isStoreUpdateModalMounted, setIsStoreUpdateModalMounted] = useState(false)
    // A staged OTA bundle wins over the store hint: it is already on the device,
    // and the gate only ever stages one this binary can run. Store updates get
    // their own modal — offering a restart for one would reload the same JS.
    const onUpdateTap = () => {
        if (pendingBundle) {
            setIsUpdateModalMounted(true)
            setIsUpdateModalOpen(true)
        } else {
            setIsStoreUpdateModalMounted(true)
            setIsStoreUpdateModalOpen(true)
        }
    }

    const logout = async () => {
        await logoutUser()
    }

    const username = user?.user.username || 'anonymous'
    // Full name or nothing: the share pill below already spells out
    // peanut.me/<username>, so falling back to the username here only printed
    // the handle twice. Empty name → ProfileHeader drops the row entirely.
    // Still respects the showFullName preference — opting out means there is
    // no name to show.
    const displayName = user?.user.showFullName && user?.user.fullName ? user.user.fullName : ''

    return (
        <div className="h-full w-full bg-background-page">
            <NavHeader
                hideLabel
                onPrev={onBack}
                rightElement={
                    // Log Out already has its own button at the bottom of this
                    // screen (below) — a second one up here was redundant. Edit
                    // profile earns the top-right slot instead: it's the one
                    // action worth reaching without scrolling.
                    <Button
                        variant="transparent"
                        href="/profile/edit"
                        icon="edit"
                        aria-label={t('menu.personalDetails')}
                        className={NAV_CIRCLE_BUTTON_CLASSES}
                    />
                }
            />
            <div className="space-y-8">
                {/* the share pill is the profile's one share affordance — the
                    copy-username icon it used to lean on was removed
                    (TASK-22121 #24), so suppressing the pill here left the
                    page with no way to share at all */}
                <ProfileHeader
                    name={displayName}
                    username={username}
                    isVerified={isUserSumsubKycApproved}
                    onChangeAvatar={() => setAvatarPickerOpen(true)}
                />
                {avatarPickerMounted && <AvatarPicker open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen} />}
                <div className="space-y-4">
                    {/* IA from #2834: identity/products first, then social +
                        account, then app settings. Payment limits moved inline
                        into Unlock payments; name visibility moved to
                        /profile/edit. */}
                    <ListGroup>
                        <ProfileMenuItem
                            icon="globe-lock"
                            label={t('menu.unlockedRegions')}
                            href="/profile/accounts-and-payments"
                            // same chip treatment as the card row's "New!" — a
                            // pulsing dot was a second attention language on
                            // one screen.
                            badge={isUserSumsubKycApproved ? undefined : t('menu.unlockBadge')}
                        />
                        {showCardMenuItem && (
                            <ProfileMenuItem icon="credit-card" label={t('menu.peanutCard')} href={cardHref} />
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
                            onClick={openInviteFriendsModal}
                            href="/dummy" // Dummy link, wont be called
                        />
                        <ProfileMenuItem icon="achievements" label={t('menu.yourBadges')} href="/badges" />
                        <ProfileMenuItem
                            icon={<Image src={STAR_STRAIGHT_ICON} alt={t('menu.starAlt')} width={20} height={20} />}
                            label={t('menu.points')}
                            href="/rewards"
                        />
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
                        {(pendingBundle || storeUpdateRequired) && (
                            <ProfileMenuItem
                                icon="download"
                                label={t('menu.updateAvailable')}
                                onClick={onUpdateTap}
                                href="/dummy"
                            />
                        )}
                        {/* Enable with Account Management project. */}
                        {/* <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            comingSoon
                        /> */}
                    </ListGroup>

                    {/* Logout + Delete account */}
                    <div className="w-full pb-2">
                        <Button
                            loading={isLoggingOut}
                            disabled={isLoggingOut}
                            variant="primary-soft"
                            shadowSize="4"
                            className="w-full"
                            onClick={logout}
                            icon="logout"
                        >
                            <span>{t('logOut')}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Load on first use, then retain the controlled root so visible=false
                can run the modal's close transition before the page unmounts. */}
            {isInviteFriendsModalMounted && (
                <InviteFriendsModal
                    visible={isInviteFriendsModalOpen}
                    onClose={() => setIsInviteFriendsModalOpen(false)}
                    username={user?.user.username ?? ''}
                    source="profile"
                />
            )}
            {isUpdateModalMounted && (
                <OtaUpdateModal visible={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} />
            )}
            {isStoreUpdateModalMounted && (
                <StoreUpdateModal visible={isStoreUpdateModalOpen} onClose={() => setIsStoreUpdateModalOpen(false)} />
            )}
        </div>
    )
}
