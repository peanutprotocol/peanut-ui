import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useZeroDev } from '@/hooks/useZeroDev'
import { saveRedirectUrl } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface GuestLoginCtaProps {
    hideConnectWallet?: boolean
    view?: 'CLAIM' | 'REQUEST'
}

const GuestLoginCta = ({ hideConnectWallet = false, view }: GuestLoginCtaProps) => {
    const { handleLogin, isLoggingIn, address: passkeyAddress } = useZeroDev()
    const toast = useToast()
    const router = useRouter()
    const { open: openReownModal } = useAppKit()

    // If user already has a passkey address, auto-redirect to avoid double prompting
    useEffect(() => {
        if (passkeyAddress && !isLoggingIn) {
            console.log('User already has passkey wallet:', passkeyAddress)
        }
    }, [passkeyAddress, isLoggingIn])

    const handleSignUp = () => {
        saveRedirectUrl()
        router.push('/setup')
    }

    const handleLoginClick = async () => {
        // Prevent double login attempts
        if (isLoggingIn || passkeyAddress) {
            return
        }

        try {
            await handleLogin()
        } catch (e) {
            toast.error('Error logging in')
            Sentry.captureException(e)
        }
    }

    return (
        <div className="w-full space-y-2 py-2">
            {/* Primary Sign Up Button */}
            <Button onClick={handleSignUp} shadowSize="4" variant="purple" className="text-sm md:text-base">
                {view === 'CLAIM' ? 'Sign Up' : 'Sign Up'}
            </Button>

            {/* Secondary Log In Button */}
            <Button
                disabled={isLoggingIn || !!passkeyAddress}
                loading={isLoggingIn}
                onClick={handleLoginClick}
                variant="transparent"
                className="!disabled:bg-transparent flex items-center justify-center gap-1 text-sm disabled:text-gray-400 md:text-base"
            >
                {/* <span className="text-grey-1">Already have Peanut? &gt; </span> */}
                <span className="font-bold">Log in</span>
            </Button>

            {/* "or" divider and External Wallet Button */}
            {!hideConnectWallet && (
                <>
                    <Divider text="or" />
                    <Button
                        onClick={() => openReownModal()}
                        variant="transparent-light"
                        className="flex w-full items-center justify-center gap-2 border border-black bg-purple-5 text-sm text-black hover:bg-purple-5 md:text-base"
                    >
                        Connect External Wallet
                    </Button>
                </>
            )}
        </div>
    )
}

export default GuestLoginCta
