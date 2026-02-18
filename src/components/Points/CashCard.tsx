'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { Tooltip } from '@/components/Tooltip'

interface CashCardProps {
    cashLeft: number
    lifetimeEarned: number
}

export const CashCard = ({ cashLeft, lifetimeEarned }: CashCardProps) => {
    return (
        <div className="flex flex-col gap-1.5">
            {/* cashback left display with tooltip */}
            <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-black">Cashback left: ${cashLeft.toFixed(2)}</h2>
                <Tooltip
                    content="You earn cashback on payments and withdrawals. Use Peanut more and invite friends to unlock a higher cashback allowance."
                    position="bottom"
                >
                    <Icon name="info" className="size-4 flex-shrink-0 text-grey-1" />
                </Tooltip>
            </div>

            {/* lifetime earned - subtle */}
            <p className="text-sm text-grey-1">Lifetime earned: ${lifetimeEarned.toFixed(2)}</p>
        </div>
    )
}
