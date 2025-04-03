import AddFunds from '../AddFunds'
import DirectionalActionButtons from '../Global/DirectionalActionButtons'

const PeanutWalletActions = () => {
    return (
        <div className="flex items-center justify-center gap-9">
            <AddFunds />
            <DirectionalActionButtons
                leftButton={{
                    title: 'Send',
                    href: '/send',
                }}
                rightButton={{
                    title: 'Receive',
                    href: '/request/create',
                }}
            />
        </div>
    )
}

export default PeanutWalletActions
