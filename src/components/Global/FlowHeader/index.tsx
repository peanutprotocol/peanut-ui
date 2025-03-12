import { Button } from '@/components/0_Bruddle'
import { usePathname } from 'next/navigation'
import Icon from '../Icon'
import WalletHeader from '../WalletHeader'

interface FlowHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    disableWalletHeader?: boolean
    hideWalletHeader?: boolean
    isPintaReq?: boolean
}

const FlowHeader = ({
    onPrev,
    disableBackBtn,
    disableWalletHeader = false,
    hideWalletHeader = false,
    isPintaReq = false,
}: FlowHeaderProps) => {
    const pathname = usePathname()
    const isSendPage = pathname === '/send'
    const isCashoutPage = pathname === '/cashout'
    const isCreateReqPage = pathname === '/request/create'
    const hideRewardsWallet = isSendPage || isCashoutPage || isCreateReqPage || !isPintaReq

    return (
        <div className="flex w-full flex-row items-center justify-between pb-3">
            {onPrev && (
                <Button variant="stroke" onClick={onPrev} disabled={disableBackBtn} className="h-11 w-11 p-0">
                    <Icon name="arrow-prev" />
                </Button>
            )}
            {!hideWalletHeader && (
                <WalletHeader
                    disabled={disableWalletHeader}
                    className={onPrev ? 'w-fit' : 'w-full'}
                    hideRewardsWallet={hideRewardsWallet}
                />
            )}
        </div>
    )
}

export default FlowHeader
