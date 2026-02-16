'use client'

import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import ShareButton from '@/components/Global/ShareButton'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import QRCode from 'react-qr-code'

interface InviteFriendsModalProps {
    visible: boolean
    onClose: () => void
    username: string
}

/**
 * Shared modal for inviting friends to Peanut.
 * Shows QR code, invite code, and share button.
 *
 * Used in: CardSuccessScreen, Profile, PointsPage
 */
export default function InviteFriendsModal({ visible, onClose, username }: InviteFriendsModalProps) {
    const { inviteCode, inviteLink } = generateInviteCodeLink(username)

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title="Invite friends!"
            description="Invite friends to Peanut and help them skip ahead on the waitlist. Once they're onboarded and start using the app, you'll earn rewards from their activity too."
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
                            <CopyToClipboard textToCopy={inviteCode} iconSize="4" />
                        </Card>
                    </div>
                    <ShareButton
                        generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                        title="Share your invite link"
                    >
                        Share Invite Link
                    </ShareButton>
                </>
            }
        />
    )
}
