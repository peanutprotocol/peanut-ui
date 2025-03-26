import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppKit } from '@reown/appkit/react'
import Link from 'next/link'

const GuestLoginModal = () => {
    const { signInModal, selectExternalWallet } = useWallet()
    const web3Modal = useAppKit()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    return (
        <Modal
            visible={signInModal.visible}
            onClose={() => {
                signInModal.close()
            }}
            title={'Sign in with your Peanut Wallet'}
        >
            <div className="flex flex-col items-center gap-2 p-5">
                <Button
                    loading={isLoggingIn}
                    disabled={isLoggingIn}
                    onClick={() => {
                        handleLogin()
                            .then(signInModal.close)
                            .catch((e) => {
                                console.error(e)
                                toast.error('Error logging in. Try a different browser')
                            })
                    }}
                >
                    Sign In
                </Button>
                <Link href={'/setup'} className="text-h8 underline" onClick={signInModal.close}>
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
                            .then(selectExternalWallet)
                            .catch((e) => {
                                console.error(e)
                                toast.error('Error connecting wallet')
                            })
                            .finally(signInModal.close)
                    }}
                >
                    Connect External Wallet 2
                </Button>
            </div>
        </Modal>
    )
}

export default GuestLoginModal
