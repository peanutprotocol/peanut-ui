import { Button } from '@/components/0_Bruddle'
import { useUserStore } from '@/redux/hooks'
import { usePathname, useSearchParams } from 'next/navigation'
import Icon from '../Icon'
import WalletHeader from '../WalletHeader'

interface FlowHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    disableWalletHeader?: boolean
    hideWalletHeader?: boolean
    isPintaReq?: boolean
    isPintaClaim?: boolean
}

const FlowHeader = ({
    onPrev,
    disableBackBtn,
    disableWalletHeader = false,
    hideWalletHeader = false,
    isPintaReq = false,
    isPintaClaim = false,
}: FlowHeaderProps) => {
    const { user } = useUserStore()

    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isSendPage = pathname === '/send'
    const isCashoutPage = pathname === '/cashout'
    const isCreateReqPage = pathname === '/request/create'
    const isClaimPage = pathname === '/claim'

    const isPintaClaimPage = isClaimPage && searchParams?.get('t') && searchParams?.get('i') && isPintaClaim

    // hide rewards wallet if:
    // 1. on send/cashout/create request pages OR
    // 2. not a pinta request and not a pinta claim
    const hideRewardsWallet = isSendPage || isCashoutPage || isCreateReqPage || (!isPintaReq && !isPintaClaimPage)

    return (
        <div className="flex w-full flex-row items-center justify-between pb-3">
            {onPrev && (
                <Button variant="stroke" onClick={onPrev} disabled={disableBackBtn} className="h-11 w-11 p-0">
                    <Icon name="arrow-prev" />
                </Button>
            )}
            {!hideWalletHeader && !!user?.user.userId && (
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
