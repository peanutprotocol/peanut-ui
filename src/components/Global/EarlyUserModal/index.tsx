'use client'
import { useEffect, useState } from 'react'
import ActionModal from '../ActionModal'
import ShareButton from '../ShareButton'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'

const EarlyUserModal = () => {
    const { user, fetchUser } = useAuth()
    const inviteLink = generateInviteCodeLink(user?.user.username ?? '').inviteLink
    const [showModal, setShowModal] = useState(false)

    useEffect(() => {
        if (user && user.showEarlyUserModal) {
            setShowModal(true)
        }
    }, [user])

    const handleCloseModal = async () => {
        setShowModal(false)
        await updateUserById({ userId: user?.user.userId, hasSeenEarlyUserModal: true })
        fetchUser()
    }

    return (
        <ActionModal
            icon="lock"
            title="You’re part of the first crew"
            visible={showModal}
            onClose={handleCloseModal}
            content={
                <>
                    <p className="text-sm text-grey-1">
                        Peanut is now <b>invite-only.</b>
                        <br />
                        As an <b>early user</b>, you keep full access and you get the power to invite friends.
                        <br />
                        Each invite earns you <b>points</b> and perks.
                    </p>
                    <ShareButton
                        generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                        title="Share your invite link"
                    >
                        Share Invite link
                    </ShareButton>
                </>
            }
        />
    )
}

export default EarlyUserModal
