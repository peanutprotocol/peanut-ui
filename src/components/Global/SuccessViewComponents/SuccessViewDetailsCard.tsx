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
        <Card className="p-4">
            <div className="flex items-start justify-between">
                {/* Left side: Icon, Amount, Description */}
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-secondary-7 font-bold`}
                    >
                        <Icon name="link" size={24} />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-h7 font-semibold">{title}</h1>
                        {amountDisplay && <h2 className="text-h5 font-bold">${amountDisplay}</h2>}

                        {description && <p className="line-clamp-3 text-sm text-grey-1">{description}</p>}
                    </div>
                </div>

                {/* Right side: Status Badge */}
                {status && <StatusBadge status={status} />}
            </div>
        </Card>
    )
}
