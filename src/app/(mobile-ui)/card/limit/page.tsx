'use client'
import { type FC } from 'react'
import ActiveCardGate from '@/components/Card/ActiveCardGate'
import CardLimitsScreen from '@/components/Card/CardLimitsScreen'

const CardLimitPage: FC = () => (
    <ActiveCardGate noCardMessageKey="limits.noActiveCard">
        {(card, onBack) => <CardLimitsScreen cardId={card.id} onPrev={onBack} />}
    </ActiveCardGate>
)

export default CardLimitPage
