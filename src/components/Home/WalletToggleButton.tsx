import { useWallet } from '@/context/walletContext'
import { NavIcons } from '../0_Bruddle'

const WalletToggleButton = () => {
    const { setSelectedWallet, wallets, selectedWallet, walletColor } = useWallet()

    const toggleWallet = () => {
        if (!wallets.length) return

        const currentIndex = wallets.findIndex((w) => w.address === selectedWallet?.address)

        // Get next wallet index (cycle back to 0 if at end)
        const nextIndex = (currentIndex + 1) % wallets.length

        setSelectedWallet(wallets[nextIndex])
    }

    return (
        <div
            className="flex flex-row justify-center py-2 hover:cursor-pointer"
            style={{
                backgroundColor: walletColor,
                borderRadius: 10,
            }}
            onClick={toggleWallet}
        >
            <NavIcons name="wallet" size={30} />
        </div>
    )
}

export default WalletToggleButton
