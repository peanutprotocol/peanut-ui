import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useZeroDev } from '@/hooks/useZeroDev'
import { saveRedirectUrl } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface GuestLoginCtaProps {
    hideConnectWallet?: boolean
}

const GuestLoginCta = ({ hideConnectWallet = false }: GuestLoginCtaProps) => {
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const router = useRouter()
    const { open: openReownModal } = useAppKit()

    const handleLoginClick = async () => {
        try {
            // check for existing passkeys
            const hasPasskeys = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(async (available) => {
                    if (!available) return false

                    // check if credentials exist for current domain
                    try {
                        const result = await navigator.credentials.get({
                            mediation: 'optional',
                            publicKey: {
                                challenge: Uint8Array.from('check-passkeys', (c) => c.charCodeAt(0)),
                                rpId: window.location.hostname.replace(/^www\./, ''),
                                timeout: 1000,
                                userVerification: 'discouraged',
                            },
                        })
                        return !!result
                    } catch (e) {
                        return false
                    }
                })
                .catch(() => false)

            if (!hasPasskeys) {
                saveRedirectUrl()
                router.push('/setup')
                return
            }

            try {
                await handleLogin()
            } catch (e) {
                toast.error('Error logging in')
                Sentry.captureException(e)
            }
        } catch (e) {
            console.error('Error checking for passkeys:', e)
            // fallback to setup if can't check passkeys
            saveRedirectUrl()
            router.push('/setup')
        }
    }

    return (
        <div className="w-full space-y-2 py-2">
            <Button
                disabled={isLoggingIn}
                loading={isLoggingIn}
                onClick={handleLoginClick}
                variant="purple"
                className="text-sm md:text-base"
            >
                Sign in with your Peanut Wallet
            </Button>
            <Link href={'/setup'} onClick={saveRedirectUrl} className="block h-8 text-center font-bold underline">
                Don't have a Peanut Wallet? Get one now!
            </Link>
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
