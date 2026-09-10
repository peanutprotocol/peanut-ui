'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import ShareButton from '../ShareButton'
import DocsLink from '@/components/Global/DocsLink'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

const EarlyUserDrawer = () => {
    const t = useTranslations('global')
    const { user, fetchUser } = useAuth()
    const inviteLink = generateInviteCodeLink(user?.user.username ?? '').inviteLink
    const [showModal, setShowModal] = useState(false)
    const hasTrackedShow = useRef(false)

    useEffect(() => {
        if (user && user.showEarlyUserModal) {
            setShowModal(true)
            if (!hasTrackedShow.current) {
                hasTrackedShow.current = true
                posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.EARLY_USER })
            }
        }
    }, [user])

    const handleCloseModal = async () => {
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.EARLY_USER })
        setShowModal(false)
        await updateUserById({ userId: user?.user.userId, hasSeenEarlyUserModal: true })
        fetchUser()
    }

    return (
        <Drawer
            open={showModal}
            onOpenChange={(isOpen) => {
                if (!isOpen) void handleCloseModal()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="lock" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('earlyUserModal.title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <p className="text-body-s text-foreground-secondary">
                            <span className="block">{t('earlyUserModal.inviteOnly')}</span>
                            <span>{t.rich('earlyUserModal.earnRules', { b: (chunks) => <b>{chunks}</b> })}</span>
                        </p>

                        <ShareButton url={inviteLink} title={t('earlyUserModal.shareSheetTitle')}>
                            {t('earlyUserModal.shareCta')}
                        </ShareButton>
                        <DocsLink href="/en/help" className="text-body-s text-foreground-secondary underline">
                            {t('earlyUserModal.learnMore')}
                        </DocsLink>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default EarlyUserDrawer
