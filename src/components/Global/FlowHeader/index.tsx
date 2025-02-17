import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import Icon from '../Icon'
import WalletHeader from '../WalletHeader'

interface FlowHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    disableWalletHeader?: boolean
}

const FlowHeader = ({ onPrev, disableBackBtn, disableWalletHeader = false }: FlowHeaderProps) => {
    const { user } = useAuth()

    // todo: check if this condition removal is affecting other flows
    // if (!user) return null

    return (
        <div className="flex w-full flex-row items-center justify-between pb-3">
            {onPrev && (
                <Button variant="stroke" onClick={onPrev} disabled={disableBackBtn} className="h-11 w-11 p-0">
                    <Icon name="arrow-prev" />
                </Button>
            )}
            {!!user && <WalletHeader disabled={disableWalletHeader} className={onPrev ? 'w-fit' : 'w-full'} />}
        </div>
    )
}

export default FlowHeader
