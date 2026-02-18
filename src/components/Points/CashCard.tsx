'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { Tooltip } from '@/components/Tooltip'

interface CashCardProps {
    hasCashbackLeft: boolean
    lifetimeEarned: number
}

export const CashCard = ({ hasCashbackLeft, lifetimeEarned }: CashCardProps) => {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-black">
                    Lifetime cashback claimed: ${lifetimeEarned.toFixed(2)}
                </h2>
                <Tooltip
                    content="You earn cashback on payments and withdrawals. Use Peanut more and invite friends to unlock a higher cashback allowance."
                    position="bottom"
                >
                    <Icon name="info" className="size-4 flex-shrink-0 text-grey-1" />
                </Tooltip>
            </div>

            {hasCashbackLeft ? (
                <p className="text-sm text-grey-1">You have more cashback left! Make a payment to receive it.</p>
            ) : (
                <p className="text-sm text-grey-1">Invite friends to unlock more cashback.</p>
            )}
        </div>
    )
}
