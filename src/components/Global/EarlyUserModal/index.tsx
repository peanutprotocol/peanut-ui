'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '../ActionModal'
import ShareButton from '../ShareButton'
import DocsLink from '@/components/Global/DocsLink'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

const EarlyUserModal = () => {
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
        <ActionModal
            icon="lock"
            title={t('earlyUserModal.title')}
            visible={showModal}
            onClose={handleCloseModal}
            content={
                <>
                    <p className="text-sm text-grey-1">
                        <span className="block">{t('earlyUserModal.inviteOnly')}</span>
                        <span>{t.rich('earlyUserModal.earnRules', { b: (chunks) => <b>{chunks}</b> })}</span>
                    </p>

                    <ShareButton url={inviteLink} title={t('earlyUserModal.shareSheetTitle')}>
                        {t('earlyUserModal.shareCta')}
                    </ShareButton>
                    <DocsLink href="/en/help" className="text-sm text-grey-1 underline">
                        {t('earlyUserModal.learnMore')}
                    </DocsLink>
                </>
            }
        />
    )
}

export default EarlyUserModal
