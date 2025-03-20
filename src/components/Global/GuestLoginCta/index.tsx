import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useZeroDev } from '@/hooks/useZeroDev'
import { saveRedirectUrl } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

interface GuestLoginCtaProps {
    hideConnectWallet?: boolean
}

const GuestLoginCta = ({ hideConnectWallet = false }: GuestLoginCtaProps) => {
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const { open: openReownModal } = useAppKit()

    return (
        <div className="w-full space-y-2 py-2">
            <Button
                disabled={isLoggingIn}
                loading={isLoggingIn}
                onClick={() => {
                    handleLogin().catch((e) => {
                        toast.error('Error logging in')
                        Sentry.captureException(e)
                    })
                }}
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
