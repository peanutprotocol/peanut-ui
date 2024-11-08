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
        <div className="flex w-full flex-row justify-between">
            <div className="flex flex-col">
                <div className="relative mb-2.5 h-21 w-21">
                    <img
                        className="rounded-full border border-black bg-white object-cover"
                        src={avatarURI}
                        alt="Avatar"
                    />
                </div>
                <div className="text-h4">{selectedWallet?.handle}</div>
            </div>
            {hasWallets && (
                <div>
                    <Button
                        loading={isLoggingIn}
                        disabled={isLoggingIn}
                        shadowSize={!isConnectWallet ? '4' : undefined}
                        variant={isConnectWallet ? 'green' : 'purple'}
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
    )
}

export default HomeHeader
