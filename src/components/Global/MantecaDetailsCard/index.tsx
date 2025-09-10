import React, { FC } from 'react'
import Card from '../Card'
import { PaymentInfoRow, PaymentInfoRowProps } from '@/components/Payment/PaymentInfoRow'

export interface MantecaCardRow extends PaymentInfoRowProps {
    key: React.Key
}

interface MantecaDetailsCardProps {
    rows: MantecaCardRow[]
}

const MantecaDetailsCard: FC<MantecaDetailsCardProps> = ({ rows }) => {
    return (
        <Card className="rounded-sm">
            {rows.map((row) => (
                <PaymentInfoRow {...row} />
            ))}
        </Card>
    )
}

export default MantecaDetailsCard
