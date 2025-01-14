import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import useAvatar from '@/hooks/useAvatar'
import { useWallet } from '@/hooks/useWallet'
import { useZeroDev } from '@/hooks/useZeroDev'
import { Button } from '../0_Bruddle'

const HomeHeader = () => {
    const { username } = useAuth()
    const { selectedWallet, wallets, isPeanutWallet, isConnected } = useWallet()
    const hasWallets = wallets.length > 0
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    const { uri: avatarURI } = useAvatar(selectedWallet ? selectedWallet.address : 'i am sad bc i dont have peanut')

    return (
        <div className="relative flex w-full flex-row justify-center">
            <div className="flex flex-row items-center gap-4">
                <div className="relative mb-2.5 h-21 w-21">
                    <img
                        className="rounded-full border border-black bg-white object-cover"
                        src={avatarURI}
                        alt="Avatar"
                    />
                </div>
                <div className="">
                    <p>www.peanut.me/</p>
                    <p className="text-h4">{username}</p>
                </div>
                {hasWallets && (isPeanutWallet || isConnected) && (
                    <div>
                        <Button
                            loading={isLoggingIn}
                            disabled={isLoggingIn}
                            shadowSize={!isConnected ? '4' : undefined}
                            variant={isConnected ? 'green' : 'purple'}
                            size="small"
                            onClick={() => {
                                if (isConnected) return
                                handleLogin().catch((_error) => {
                                    toast.error('Error logging in')
                                })
                            }}
                        >
                            {isConnected ? 'Connected' : 'Sign In'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HomeHeader
