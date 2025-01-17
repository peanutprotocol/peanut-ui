import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useWallet, useWalletConnection } from '@/hooks/useWallet'

const AddWallets = () => {
    const { handleNext } = useSetupFlow()
    const { isExternalWallet } = useWallet()
    const { connectWallet: connectNewWallet } = useWalletConnection()

    const handleConnect = async () => {
        if (isExternalWallet) return
        connectNewWallet().then(() => {
            handleNext()
        })
    }

    return (
        <div className="flex h-full flex-col justify-end gap-2">
            <Button variant="purple" onClick={handleConnect} shadowSize="4">
                {isExternalWallet ? 'Next' : 'Connect'}
            </Button>
        </div>
    )
}

export default AddWallets
