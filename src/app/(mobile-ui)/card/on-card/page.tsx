'use client'
import { type FC } from 'react'
import ActiveCardGate from '@/components/Card/ActiveCardGate'
import OnCardScreen from '@/components/Card/OnCardScreen'

const OnCardPage: FC = () => (
    <ActiveCardGate noCardMessageKey="onCard.noActiveCard">
        {(card, onBack) => <OnCardScreen cardId={card.id} onPrev={onBack} />}
    </ActiveCardGate>
)

export default OnCardPage
