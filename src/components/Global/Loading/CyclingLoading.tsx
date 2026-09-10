'use client'

import { PEANUTMAN } from '@/assets/mascot'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PAYMENT_LOADING_WORD_KEYS } from './words'

const ROTATE_MS = 1800

export default function CyclingLoading() {
    const t = useTranslations('paymentLoading')
    const [index, setIndex] = useState(() => Math.floor(Math.random() * PAYMENT_LOADING_WORD_KEYS.length))

    useEffect(() => {
        const id = setInterval(() => {
            setIndex((i) => {
                let next = i
                while (next === i) next = Math.floor(Math.random() * PAYMENT_LOADING_WORD_KEYS.length)
                return next
            })
        }, ROTATE_MS)
        return () => clearInterval(id)
    }, [])

    const word = t(PAYMENT_LOADING_WORD_KEYS[index])

    return (
        <div className="w-full flex-col items-center justify-center self-center text-center">
            <div className="flex w-full items-center justify-center self-center">
                <div className="animate-spin">
                    <Image src={PEANUTMAN} alt="logo" className="h-10 w-auto" />
                    <span className="sr-only">{word}</span>
                </div>
            </div>
            <div key={word} className="animate-cycling-fade mt-6 self-center text-center font-medium tabular-nums">
                <span>{word}</span>
                <span className="ml-px inline-block">
                    <span className="animate-cycling-blink">.</span>
                    <span className="animate-cycling-blink [animation-delay:0.2s]">.</span>
                    <span className="animate-cycling-blink [animation-delay:0.4s]">.</span>
                </span>
            </div>
        </div>
    )
}
