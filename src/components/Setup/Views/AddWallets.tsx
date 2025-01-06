import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppKit } from '@reown/appkit/react'
import { useAccount } from 'wagmi'

const AddWallets = () => {
    const { open } = useAppKit()
    const { isConnected, isConnecting } = useAccount()
    const { handleNext } = useSetupFlow()

    // todo: replace with new add-wallet component when ready
    const handleWalletConnect = () => {
        if (isConnected) {
            handleNext()
        } else {
            open()
        }
    }

    return (
        <div className="flex h-full flex-col justify-end gap-2">
            <Button variant="purple" disabled={isConnecting} onClick={handleWalletConnect} shadowSize="4">
                {isConnected ? 'Next' : 'Connect'}
            </Button>
        </div>
    )
}

export default AddWallets
