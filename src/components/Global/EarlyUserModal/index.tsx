'use client'
import { useEffect, useRef, useState } from 'react'
import ActionModal from '../ActionModal'
import ShareButton from '../ShareButton'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

const EarlyUserModal = () => {
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
            title="Earn from invites"
            visible={showModal}
            onClose={handleCloseModal}
            content={
                <>
                    <p className="text-sm text-grey-1">
                        <span className="block">Peanut is now invite-only and you're in!</span>
                        <span>
                            <b>Friends you invite →</b> you earn a cut of their fees. <b>Their invites →</b> you earn a
                            cut of their cut.
                        </span>
                    </p>

                    <ShareButton
                        generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                        title="Share your invite link"
                    >
                        Share Invite link
                    </ShareButton>
                    <a
                        className="text-sm text-grey-1 underline"
                        href="/en/help"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Learn more
                    </a>
                </>
            }
        />
    )
}

export default EarlyUserModal
