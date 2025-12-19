'use client'
import { ARBITRUM_ICON } from '@/assets'
import { type CryptoToken, DEPOSIT_CRYPTO_TOKENS } from '@/components/AddMoney/consts'
import { CryptoDepositQR } from '@/components/AddMoney/views/CryptoDepositQR.view'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useRouter } from 'next/navigation'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

interface AddMoneyCryptoPageProps {
    headerTitle?: string
    onBack?: () => void
    depositAddress?: string
}

const AddMoneyCryptoPage = ({ headerTitle, onBack, depositAddress }: AddMoneyCryptoPageProps) => {
    const router = useRouter()
    const { address: peanutWalletAddress, isConnected } = useWallet()

    // default to usdc on arbitrum (the recommended option from CryptoMethodDrawer)
    const selectedToken: CryptoToken = DEPOSIT_CRYPTO_TOKENS[0] // USDC
    const selectedNetwork = {
        chainId: PEANUT_WALLET_CHAIN.id.toString(),
        name: PEANUT_WALLET_CHAIN.name,
        iconUrl: ARBITRUM_ICON,
    }

    if (!isConnected) {
        return <PeanutLoading />
    }

    // Ensure we have a valid deposit address
    const finalDepositAddress = depositAddress ?? peanutWalletAddress
    if (!finalDepositAddress) {
        router.push('/')
        return null
    }

    return (
        <CryptoDepositQR
            tokenName={selectedToken.symbol}
            tokenIcon={selectedToken.icon}
            chainName={selectedNetwork.name}
            chainIcon={selectedNetwork.iconUrl}
            depositAddress={finalDepositAddress}
            onBack={() => router.back()}
        />
    )
}

export default AddMoneyCryptoPage
