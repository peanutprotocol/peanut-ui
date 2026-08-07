'use client'

import ActionModal from '@/components/Global/ActionModal'
import ShareButton from '@/components/Global/ShareButton'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { ANALYTICS_EVENTS, MODAL_TYPES, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import QRCode from 'react-qr-code'

interface InviteFriendsModalProps {
    visible: boolean
    onClose: () => void
    username: string
    source?: string
}

/**
 * Shared modal for inviting friends to Peanut. Reframed to "your username
 * IS your invite" — no more raw-code copy line. Friends just need to enter
 * the username on the /setup waitlist gate.
 *
 * Used in: CardSuccessScreen, Profile, PointsPage
 */
export default function InviteFriendsModal({ visible, onClose, username, source }: InviteFriendsModalProps) {
    const t = useTranslations('global')
    const { inviteLink } = generateInviteCodeLink(username)

    const hasTrackedShow = useRef(false)

    useEffect(() => {
        if (visible && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.INVITE, source })
            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, { source: source ?? REFERRAL_SOURCES.INVITE_MODAL })
        }
    }, [visible, source])

    const handleClose = () => {
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.INVITE, source })
        onClose()
    }

    return (
        <ActionModal
            visible={visible}
            onClose={handleClose}
            title={t('inviteFriendsModal.title')}
            description={t('inviteFriendsModal.description')}
            icon="user-plus"
            content={
                <>
                    {inviteLink && (
                        <div className="my-2 size-44">
                            <QRCode
                                value={inviteLink}
                                size={120}
                                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                viewBox="0 0 120 120"
                                level="H"
                            />
                        </div>
                    )}
                    <ShareButton
                        url={inviteLink}
                        title={t('inviteFriendsModal.shareSheetTitle')}
                        onSuccess={() => {
                            posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, { source })
                            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                                source: source ?? REFERRAL_SOURCES.INVITE_MODAL,
                            })
                        }}
                    >
                        {t('inviteFriendsModal.shareCta')}
                    </ShareButton>
                </>
            }
        />
    )
}
