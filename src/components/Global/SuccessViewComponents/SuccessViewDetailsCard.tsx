import { Card } from '@/components/0_Bruddle/Card'
import React from 'react'
import StatusBadge, { StatusType } from '../Badges/StatusBadge'
import { Icon } from '../Icons/Icon'

interface SuccessViewDetailsCardProps {
    title: string
    amountDisplay?: string
    description?: string
    status?: StatusType
}

export const SuccessViewDetailsCard: React.FC<SuccessViewDetailsCardProps> = ({
    title,
    amountDisplay,
    description,
    status = 'completed',
}) => {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                {/* Left side: Icon, Amount, Description */}
                <div className="flex items-center gap-3">
                    <div
                        className={`flex h-14 w-14 min-w-14 items-center justify-center rounded-full bg-secondary-7 font-bold`}
                    >
                        <Icon name="link" size={32} className="text-white" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-lg font-bold">{title}</h1>
                        {amountDisplay && <h2 className="text-4xl font-extrabold">$ {amountDisplay}</h2>}

                        {description && <p className="line-clamp-3 text-sm text-grey-1">for {description}</p>}
                    </div>
                </div>

                {/* Right side: Status Badge */}
                {status && <StatusBadge status={status} />}
            </div>
        </Card>
    )
}
