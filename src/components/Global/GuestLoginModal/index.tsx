import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useAppKit } from '@reown/appkit/react'
import Link from 'next/link'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'

const GuestLoginModal = () => {
    const dispatch = useAppDispatch()
    const { signInModalVisible } = useWalletStore()
    const web3Modal = useAppKit()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    const closeModal = () => {
        dispatch(walletActions.setSignInModalVisible(false))
    }

    return (
        <Modal visible={signInModalVisible} onClose={closeModal} title={'Sign in with your Peanut Wallet'}>
            <div className="flex flex-col items-center gap-2 p-5">
                <Button
                    loading={isLoggingIn}
                    disabled={isLoggingIn}
                    onClick={() => {
                        handleLogin()
                            .then(closeModal)
                            .catch((e) => {
                                console.error(e)
                                toast.error('Error logging in')
                            })
                    }}
                >
                    Sign In
                </Button>
                <Link href={'/setup'} className="text-h8 underline" onClick={closeModal}>
                    Don't have a Peanut wallet? Get one now.
                </Link>
                <div className="my-2 flex w-full items-center gap-4">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-sm text-gray-500">or</span>
                    <div className="h-px flex-1 bg-gray-200" />
                </div>
                <Button
                    disabled={isLoggingIn}
                    variant="dark"
                    shadowType="secondary"
                    onClick={() => {
                        web3Modal
                            .open()
                            .catch((e) => {
                                console.error(e)
                                toast.error('Error connecting wallet')
                            })
                            .finally(closeModal)
                    }}
                >
                    Connect External Wallet
                </Button>
            </div>
        </Modal>
    )
}

export default GuestLoginModal
