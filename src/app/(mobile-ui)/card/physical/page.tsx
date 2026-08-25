'use client'
import { type FC } from 'react'
import ActiveCardGate from '@/components/Card/ActiveCardGate'
import PhysicalCardScreen from '@/components/Card/PhysicalCardScreen'

const PhysicalCardPage: FC = () => (
    <ActiveCardGate>
        {(card, onBack) => <PhysicalCardScreen cardId={card.id} last4={card.last4} onPrev={onBack} />}
    </ActiveCardGate>
)

export default PhysicalCardPage
