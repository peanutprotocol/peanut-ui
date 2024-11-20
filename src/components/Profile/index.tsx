'use client'

import Icon from '../Global/Icon'
import AddressLink from '../Global/AddressLink'
import { useContext, useState } from 'react'
import { useSignMessage } from 'wagmi'
import * as utils from '@/utils'
import Modal from '../Global/Modal'
import { useAuth } from '@/context/authContext'
import * as context from '@/context'
import { Button, Card } from '../0_Bruddle'
import ProfileHeader from './Components/ProfileHeader'
import { useWallet } from '@/context/walletContext'

export const Profile = () => {
    const { address } = useWallet()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { signMessageAsync } = useSignMessage()
    const { user, fetchUser, isFetchingUser, logoutUser } = useAuth()

    const [_isLoading, _setIsLoading] = useState(false)
    const [modalVisible, setModalVisible] = useState(false)
    const [modalType, setModalType] = useState<'Boost' | 'Invites' | undefined>(undefined)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleSiwe = async () => {
        try {
            _setIsLoading(true)
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            if (!address) return

            const userIdResponse = await fetch('/api/peanut/user/get-user-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountIdentifier: address,
                }),
            })

            const response = await userIdResponse.json()

            const siwemsg = utils.createSiweMessage({
                address: address ?? '',
                statement: `Sign in to peanut.to. This is your unique user identifier! ${response.userId}`,
            })

            const signature = await signMessageAsync({
                message: siwemsg,
            })

            await fetch('/api/peanut/user/get-jwt-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    signature: signature,
                    message: siwemsg,
                }),
            })

            fetchUser()
        } catch (error) {
            console.error('Authentication error:', error)
            setErrorState({
                showError: true,
                errorMessage: 'Error while authenticating. Please try again later.',
            })
        } finally {
            _setIsLoading(false)
        }
    }

    const handleLogout = async () => {
        try {
            setLoadingState('Logging out')
            await logoutUser()
        } catch (error) {
            console.error('Error logging out', error)
            setErrorState({
                showError: true,
                errorMessage: 'Error logging out',
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    if (!user) {
        // TODO: Sign In User Here
        return (
            <div className="flex h-full w-full flex-col items-center justify-center">
                <Button disabled className="w-[80%] sm:w-[120px]">
                    Sign In
                </Button>
            </div>
        )
    } else
        return (
            <div className="col h-full w-full  items-center justify-start gap-4">
                <div className={`col w-full items-center justify-center gap-2`}>
                    <div className="col w-full items-center justify-center gap-2 sm:flex-row sm:justify-between">
                        <div className="col w-full gap-2">
                            <ProfileHeader />
                        </div>
                        <div className="col w-full min-w-[250px] gap-4 sm:w-auto">
                            <Card shadowSize="4">
                                <Card.Header className="border-b-0 sm:items-start">
                                    <Card.Title>{user?.totalPoints} points</Card.Title>
                                    <Card.Description className="">
                                        <span className="flex items-center justify-center gap-1">
                                            <Icon name={'heart'} />
                                            Invites {user?.referredUsers}
                                            {user?.referredUsers > 0 && (
                                                <Icon
                                                    name={'info'}
                                                    className={`cursor-pointer transition-transform dark:fill-white`}
                                                    onClick={() => {
                                                        setModalVisible(true)
                                                        setModalType('Invites')
                                                    }}
                                                />
                                            )}
                                        </span>
                                    </Card.Description>
                                </Card.Header>
                            </Card>
                            <Button variant="stroke" size="small" loading={isLoading} onClick={handleLogout}>
                                {isLoading ? loadingState : 'Logout'}
                            </Button>
                        </div>
                    </div>
                    <Modal
                        visible={modalVisible}
                        onClose={() => {
                            setModalVisible(false)
                        }}
                        title={modalType}
                        classNameWrapperDiv="px-5 pb-7 pt-8"
                    >
                        {
                            <div className="flex w-full flex-col items-center justify-center gap-2 text-h7">
                                <div>
                                    <label className="w-[42%] text-h9">Address</label>
                                    <label className="w-[28%] text-h9">Referred Users</label>
                                    <label className="w-[30%] text-right text-h9">Points</label>
                                </div>
                                {user?.referredUsers &&
                                    user?.referredUsers > 0 &&
                                    user?.pointsPerReferral.map((referral, index) => (
                                        <div key={index} className="flex w-full items-center justify-between">
                                            <label
                                                className="w-[40%] cursor-pointer truncate text-h8"
                                                onClick={() => {
                                                    window.open(
                                                        `https://debank.com/profile/${referral.address}/history`,
                                                        '_blank'
                                                    )
                                                }}
                                            >
                                                <Icon
                                                    name={'external'}
                                                    className="mb-1 cursor-pointer"
                                                    onClick={() => {
                                                        window.open(
                                                            `https://debank.com/profile/${referral.address}/history`,
                                                            '_blank'
                                                        )
                                                    }}
                                                />
                                                <AddressLink address={referral.address} />
                                            </label>
                                            <label className="w-[30%] text-center text-h8">
                                                {referral?.totalReferrals ?? 0}
                                            </label>
                                            <label className="w-[30%] text-right text-h8">
                                                {Math.floor(
                                                    user.pointsPerReferral?.find((ref) =>
                                                        utils.areTokenAddressesEqual(ref.address, referral.address)
                                                    )?.points ?? 0
                                                )}
                                            </label>
                                        </div>
                                    ))}

                                <div className="flex w-full items-center justify-between">
                                    <label className="w-[40%]">Total</label>
                                    <label className="w-[30%] text-center">{user?.totalReferralConnections}</label>
                                    <label className="w-[30%] text-right">{user?.totalReferralPoints}</label>
                                </div>
                            </div>
                        }
                    </Modal>
                </div>
            </div>
        )
}
