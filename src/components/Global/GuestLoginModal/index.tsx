import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import { useZeroDev } from '@/hooks/useZeroDev'
import Link from 'next/link'
import { useModalsContext } from '@/context/ModalsContext'

const GuestLoginModal = () => {
    const { isSignInModalOpen, setIsSignInModalOpen } = useModalsContext()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    const closeModal = () => {
        setIsSignInModalOpen(false)
    }

    return (
        <Modal visible={isSignInModalOpen} onClose={closeModal} title={'Sign in with your Peanut Wallet'}>
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
            </div>
        </Modal>
    )
}

export default GuestLoginModal
