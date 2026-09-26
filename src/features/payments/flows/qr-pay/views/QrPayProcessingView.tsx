'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { PAYMENT_LOADING_WORD_KEYS } from '@/components/Global/Loading/words'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

// the old CyclingLoading cadence: a new word every 1.8s, drawn at random from
// the pool, never the same word twice in a row
const ROTATE_MS = 1800

function pickNext(current: number): number {
    if (PAYMENT_LOADING_WORD_KEYS.length < 2) return current
    let next = current
    while (next === current) next = Math.floor(Math.random() * PAYMENT_LOADING_WORD_KEYS.length)
    return next
}

export function QrPayProcessingView() {
    const t = useAppTranslations('qrPay')
    const tWords = useTranslations('paymentLoading')
    // deterministic first word so a server render (the dev preview) matches
    // hydration; the random start is picked once mounted
    const [index, setIndex] = useState(0)

    useEffect(() => {
        setIndex((current) => pickNext(current))
        const id = setInterval(() => setIndex((current) => pickNext(current)), ROTATE_MS)
        return () => clearInterval(id)
    }, [])

    const word = tWords(PAYMENT_LOADING_WORD_KEYS[index])

    return <ProcessingScreen title={t('processingPaymentTitle')} description={`${word}...`} />
}
