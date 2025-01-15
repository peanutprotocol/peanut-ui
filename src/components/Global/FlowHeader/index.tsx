import { Button } from '@/components/0_Bruddle'
import Icon from '../Icon'
import WalletHeader from '../WalletHeader'

interface FlowHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    disableWalletHeader?: boolean
}

const FlowHeader = ({ onPrev, disableBackBtn, disableWalletHeader = false }: FlowHeaderProps) => {
    return (
        <div className="flex w-full flex-row items-center justify-between pb-3">
            {onPrev && (
                <Button variant="stroke" onClick={onPrev} disabled={disableBackBtn} className="h-11 w-11 p-0">
                    <Icon name="arrow-prev" />
                </Button>
            )}
            <WalletHeader disabled={disableWalletHeader} className={onPrev ? 'w-fit' : 'w-full'} />
        </div>
    )
}

export default FlowHeader
