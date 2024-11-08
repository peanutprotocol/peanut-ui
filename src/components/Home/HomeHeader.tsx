import { useWallet } from '@/context/walletContext'
import useAvatar from '@/hooks/useAvatar'
import { Button } from '../0_Bruddle'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'

const HomeHeader = () => {
    const { selectedWallet, wallets } = useWallet()
    const hasWallets = wallets.length > 0
    const { handleLogin, isLoggingIn } = useZeroDev()
    const isConnectWallet = selectedWallet?.connected

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
                    <p>www.peanute.me/</p>
                    <p className="text-h4">{selectedWallet?.handle}</p>
                </div>
                {hasWallets && (
                    <div>
                        <Button
                            loading={isLoggingIn}
                            disabled={isLoggingIn}
                            shadowSize={!isConnectWallet ? '4' : undefined}
                            variant={isConnectWallet ? 'green' : 'purple'}
                            size="small"
                            onClick={() => {
                                if (!selectedWallet?.handle) return
                                handleLogin(selectedWallet?.handle)
                            }}
                        >
                            {isConnectWallet ? 'Connected' : 'Sign In'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HomeHeader
