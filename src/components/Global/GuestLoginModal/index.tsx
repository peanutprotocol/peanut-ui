import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal from '@/components/Global/ActionModal'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import { getPasskeyErrorCode, getPasskeyErrorSetupKey } from '@/utils/webauthn.utils'
import { useLoginRecovery } from '@/hooks/useLoginRecovery'
import { LoginRecoveryDrawer } from '@/components/Setup/Views/LoginRecoveryDrawer'

const GuestLoginModal = () => {
    const t = useTranslations('global')
    const tSetup = useTranslations('setup')
    const { isSignInModalOpen, setIsSignInModalOpen } = useModalsContext()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const { offersRecovery, openRecovery, recoveryDrawer } = useLoginRecovery({ onRetry: () => signIn() })

    const closeModal = () => {
        setIsSignInModalOpen(false)
    }

    const signIn = () => {
        handleLogin()
            .then(closeModal)
            .catch((error: unknown) => {
                if (offersRecovery(getPasskeyErrorCode(error))) {
                    closeModal()
                    openRecovery()
                    return
                }
                // useZeroDev already reported the underlying failure;
                // console.error here would capture the wrapper again.
                const recoveryKey = getPasskeyErrorSetupKey(error)
                toast.error(recoveryKey ? tSetup(recoveryKey) : t('guestLoginModal.loginError'))
            })
    }

    return (
        <>
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
                        onClick: signIn,
                    },
                ]}
                tertiaryCta={{ text: t('guestLoginModal.noWallet'), href: '/setup', onClick: closeModal }}
            />
            <LoginRecoveryDrawer {...recoveryDrawer} />
        </>
    )
}

export default GuestLoginModal
