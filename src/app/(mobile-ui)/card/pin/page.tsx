'use client'
import { type FC } from 'react'
import ActiveCardGate from '@/components/Card/ActiveCardGate'
import CardPinScreen from '@/components/Card/CardPinScreen'

const CardPinPage: FC = () => (
    <ActiveCardGate>{(card, onBack) => <CardPinScreen cardId={card.id} onPrev={onBack} />}</ActiveCardGate>
)

export default CardPinPage
