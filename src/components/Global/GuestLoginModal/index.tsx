import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal from '@/components/Global/ActionModal'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useModalsContext } from '@/context/ModalsContext'

const GuestLoginModal = () => {
    const t = useTranslations('global')
    const { isSignInModalOpen, setIsSignInModalOpen } = useModalsContext()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    const closeModal = () => {
        setIsSignInModalOpen(false)
    }

    return (
        <ActionModal
            visible={isSignInModalOpen}
            onClose={closeModal}
            title={t('guestLoginModal.title')}
            ctas={[
                {
                    text: t('guestLoginModal.signInCta'),
                    loading: isLoggingIn,
                    disabled: isLoggingIn,
                    onClick: () => {
                        handleLogin()
                            .then(closeModal)
                            .catch((e) => {
                                console.error(e)
                                toast.error(t('guestLoginModal.loginError'))
                            })
                    },
                },
            ]}
            footer={
                <Link href={'/setup'} className="text-h8 underline" onClick={closeModal}>
                    {t('guestLoginModal.noWallet')}
                </Link>
            }
        />
    )
}

export default GuestLoginModal
