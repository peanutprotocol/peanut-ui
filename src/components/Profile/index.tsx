'use client'

import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { fetchWithSentry, areEvmAddressesEqual, createSiweMessage } from '@/utils'
import { useContext, useState } from 'react'
import { useSignMessage } from 'wagmi'
import { Button } from '../0_Bruddle'
import AddressLink from '../Global/AddressLink'
import Icon from '../Global/Icon'
import Modal from '../Global/Modal'
import ProfileHeader from './Components/ProfileHeader'
import ProfileSection from './Components/ProfileSection'
import ProfileWalletBalance from './Components/ProfileWalletBalance'

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

            const userIdResponse = await fetchWithSentry('/api/peanut/user/get-user-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountIdentifier: address,
                }),
            })

            const response = await userIdResponse.json()

            const siwemsg = createSiweMessage({
                address: address ?? '',
                statement: `Sign in to peanut.to. This is your unique user identifier! ${response.userId}`,
            })

            const signature = await signMessageAsync({
                message: siwemsg,
            })

            await fetchWithSentry('/api/peanut/user/get-jwt-token', {
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
                        <div className="col w-full gap-5">
                            <ProfileHeader />
                            <ProfileSection />
                            <ProfileWalletBalance />
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
                                {user?.referredUsers > 0 &&
                                    user?.pointsPerReferral.map(
                                        (
                                            referral: { address: string; points: number; totalReferrals: number },
                                            index: number
                                        ) => (
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
                                                            areEvmAddressesEqual(ref.address, referral.address)
                                                        )?.points ?? 0
                                                    )}
                                                </label>
                                            </div>
                                        )
                                    )}

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
