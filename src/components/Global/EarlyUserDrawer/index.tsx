'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import ShareButton from '../ShareButton'
import DocsLink from '@/components/Global/DocsLink'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { useOtherOpenOverlays } from '@/utils/overlay-visibility'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES, REFERRAL_SOURCES } from '@/constants/analytics.consts'

const EarlyUserDrawer = ({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) => {
    const t = useTranslations('global')
    const { user, fetchUser } = useAuth()
    const inviteLink = generateInviteCodeLink(user?.user.username ?? '', REFERRAL_SOURCES.EARLY_USER_DRAWER).inviteLink
    const overlayOwner = useRef(Symbol('early-user'))
    const otherOverlayOpen = useOtherOpenOverlays(overlayOwner.current)
    const modals = useModalsContextOptional()
    const userId = user?.user.userId
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    const trackedFor = useRef<string | null>(null)
    // Wait for consent even before its status request produces a modal. Account
    // switches must not reuse the previous account's cleared consent check.
    const legalGate = modals?.legalConsentGate
    const legalPending =
        !!legalGate && (legalGate.status !== 'clear' || (legalGate.userId !== null && legalGate.userId !== userId))
    const contextOverlayOpen =
        !!modals &&
        (modals.isSignInModalOpen ||
            modals.isGetAppModalOpen ||
            modals.isSupportModalOpen ||
            modals.isQRScannerOpen ||
            modals.isSecurityVerificationOpen)
    const showModal =
        !!userId &&
        !!user?.showEarlyUserModal &&
        dismissedFor !== userId &&
        !legalPending &&
        !contextOverlayOpen &&
        !otherOverlayOpen

    useEffect(() => {
        onVisibilityChange?.(showModal)
        if (showModal && trackedFor.current !== userId) {
            trackedFor.current = userId ?? null
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.EARLY_USER })
        }
    }, [showModal, userId, onVisibilityChange])

    const handleCloseModal = async () => {
        // Being preempted by another surface is not a user dismissal and must
        // never acknowledge the announcement or prevent it from resuming.
        if (!showModal || !userId) return
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.EARLY_USER })
        setDismissedFor(userId)
        await updateUserById({ userId, hasSeenEarlyUserModal: true })
        fetchUser()
    }

    // Unmount immediately when yielding: a closing Vaul portal otherwise keeps
    // its overlay/focus lock alive during the new surface's opening animation.
    if (legalPending || contextOverlayOpen || otherOverlayOpen) return null

    return (
        <Drawer
            open={showModal}
            overlayOwner={overlayOwner.current}
            onOpenChange={(isOpen) => {
                if (!isOpen) void handleCloseModal()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="user-plus" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('earlyUserModal.title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <p className="text-body-s text-foreground-secondary">{t('earlyUserModal.description')}</p>

                        <ShareButton url={inviteLink} title={t('earlyUserModal.shareSheetTitle')}>
                            {t('earlyUserModal.shareCta')}
                        </ShareButton>
                        {/* DocsLink keeps the locale + native behavior; the chrome is LinkButton's. */}
                        <DocsLink href="/en/help" className={LINK_BUTTON_CLASSES}>
                            {t('earlyUserModal.learnMore')}
                        </DocsLink>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default EarlyUserDrawer
