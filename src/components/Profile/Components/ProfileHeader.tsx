import ImageEdit from '../../Global/ImageEdit'
import TextEdit from '../../Global/TextEdit'
import { Badge } from '../../0_Bruddle/Badge'
import Link from 'next/link'
import { printableAddress } from '@/utils'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'
import useAvatar from '@/hooks/useAvatar'

const ProfileHeader = () => {
    const { updateUserName, submitProfilePhoto, user } = useAuth()
    const [initialUserName, setInitialUserName] = useState(
        user?.user?.username ??
            user?.user?.email ??
            (user?.accounts ? printableAddress(user?.accounts[0]?.account_identifier) : '')
    )

    const { uri: avatarURI } = useAvatar(user?.user?.username ?? user?.user?.email ?? '')
    const hasKYCed = user?.user?.kycStatus === 'verified'

    useEffect(() => {
        setInitialUserName(user?.user?.username ?? '')
    }, [user])

    return (
        <div className="col w-full items-center sm:items-start">
            <ImageEdit
                initialProfilePicture={user?.user?.profile_picture ? user?.user?.profile_picture : avatarURI}
                onImageChange={(file) => {
                    if (!file) return
                    submitProfilePhoto(file)
                }}
            />
            <div className="col items-center sm:items-start">
                <TextEdit
                    initialText={initialUserName ?? ''}
                    onTextChange={(text) => {
                        setInitialUserName(text)
                        updateUserName(text)
                    }}
                />
                {user && (
                    <p className="text-sm">
                        {user?.user?.email ?? printableAddress(user?.accounts?.[0]?.account_identifier)}
                    </p>
                )}
                <div className={`flex flex-row items-center justify-center `}>
                    <Badge color={hasKYCed ? 'green' : 'black'} variant="stroke">
                        {hasKYCed ? (
                            'KYC'
                        ) : (
                            <Link className="px-2 py-1" href={'/kyc'}>
                                NO KYC
                            </Link>
                        )}
                    </Badge>
                </div>
            </div>
        </div>
    )
}

export default ProfileHeader
