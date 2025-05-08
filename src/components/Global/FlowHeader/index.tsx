import { Button } from '@/components/0_Bruddle'
import { Icon } from '../Icons/Icon'
import { ReactNode } from 'react'

interface FlowHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    rightElement?: ReactNode
}

const FlowHeader = ({ onPrev, disableBackBtn, rightElement }: FlowHeaderProps) => {
    return (
        <div className="flex h-7 flex-row justify-between pb-3">
            <div className="w-fit">
                {onPrev && (
                    <Button variant="stroke" className="h-7 w-7 p-0" onClick={onPrev} disabled={disableBackBtn}>
                        <Icon name="chevron-up" size={32} className="h-8 w-8 -rotate-90" />
                    </Button>
                )}
            </div>
            {rightElement && <div className="w-fit">{rightElement}</div>}
        </div>
    )
}

export default FlowHeader
