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
            title="Earn from invites"
            visible={showModal}
            onClose={handleCloseModal}
            content={
                <>
                    <p className="text-sm text-grey-1">
                        <span className="block">
                            Peanut is now <b>invite-only</b> and you're in!
                        </span>
                        <span className="mt-2 block">
                            <b>Friends you invite </b>→ you earn a cut of their fees
                        </span>
                        <span className="block">
                            <b> Their invites </b> → you earn a cut of the cut
                        </span>
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
