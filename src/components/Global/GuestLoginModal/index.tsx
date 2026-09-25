import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal from '@/components/Global/ActionModal'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useTranslations } from 'next-intl'
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
            tone="peanut"
            icon="wallet"
            title={t('guestLoginModal.title')}
            ctas={[
                {
                    text: t('guestLoginModal.signInCta'),
                    loading: isLoggingIn,
                    disabled: isLoggingIn,
                    onClick: () => {
                        handleLogin()
                            .then(closeModal)
                            .catch(() => {
                                // useZeroDev already reported the underlying failure;
                                // console.error here would capture the wrapper again.
                                toast.error(t('guestLoginModal.loginError'))
                            })
                    },
                },
            ]}
            tertiaryCta={{ text: t('guestLoginModal.noWallet'), href: '/setup', onClick: closeModal }}
        />
    )
}

export default GuestLoginModal
