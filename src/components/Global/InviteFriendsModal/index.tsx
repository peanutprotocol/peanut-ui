'use client'

import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import ShareButton from '@/components/Global/ShareButton'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'
import QRCode from 'react-qr-code'

interface InviteFriendsModalProps {
    visible: boolean
    onClose: () => void
    username: string
    source?: string
}

/**
 * Shared modal for inviting friends to Peanut.
 * Shows QR code, invite code, and share button.
 *
 * Used in: CardSuccessScreen, Profile, PointsPage
 */
export default function InviteFriendsModal({ visible, onClose, username, source }: InviteFriendsModalProps) {
    const { inviteCode, inviteLink } = generateInviteCodeLink(username)

    const hasTrackedShow = useRef(false)

    useEffect(() => {
        if (visible && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.INVITE, source })
            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, { source: source ?? 'invite_modal' })
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
            title="Invite friends!"
            description="Invite friends to Peanut. Every time they make a payment, you earn rewards."
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
                    <div className="flex w-full items-center justify-between gap-3">
                        <Card className="flex items-center justify-between py-2">
                            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold">
                                {inviteCode}
                            </p>
                            <CopyToClipboard
                                textToCopy={inviteCode}
                                iconSize="4"
                                onCopy={() => posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_COPIED, { source })}
                            />
                        </Card>
                    </div>
                    <ShareButton
                        generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                        title="Share your invite link"
                        onSuccess={() => {
                            posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, { source })
                            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                                source: source ?? 'invite_modal',
                            })
                        }}
                    >
                        Share Invite Link
                    </ShareButton>
                </>
            }
        />
    )
}
