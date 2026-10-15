'use client'

import { HomePage } from '@/features/home/HomePage'
import { useHomeShakeToPay } from '@/features/shake-to-pay/useHomeShakeToPay'

export default function Home() {
    useHomeShakeToPay()
    return <HomePage />
}
