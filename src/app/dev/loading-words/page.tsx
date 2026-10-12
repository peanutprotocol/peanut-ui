'use client'

import { PEANUTMAN } from '@/assets/mascot'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { Section } from '@/components/0_Bruddle/Section'
import { PAYMENT_LOADING_WORD_KEYS } from '@/components/Global/Loading/words'
import { QrPayProcessingView } from '@/features/payments/flows/qr-pay/views/QrPayProcessingView'
import en from '@/i18n/app/messages/en.json'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const WORDS = PAYMENT_LOADING_WORD_KEYS.map((key) => en.paymentLoading[key])

const ROTATE_MS = 1800

export default function LoadingWordsPreview() {
    const [index, setIndex] = useState(0)
    const [shuffle, setShuffle] = useState(false)

    useEffect(() => {
        const id = setInterval(() => {
            setIndex((i) => {
                if (!shuffle) return (i + 1) % WORDS.length
                let next = i
                while (next === i) next = Math.floor(Math.random() * WORDS.length)
                return next
            })
        }, ROTATE_MS)
        return () => clearInterval(id)
    }, [shuffle])

    return (
        <DevPageShell
            title="Loading words preview"
            description="Cycling payment-loading words with animated dots, including the production mascot treatment."
            width="prose"
        >
            <Section title="QR pay — Paying screen (TASK-22713)">
                <div className="mx-auto flex min-h-[560px] w-full max-w-[390px] flex-col bg-background-page p-4">
                    <QrPayProcessingView />
                </div>
            </Section>

            <Section title='Production match — Loading variant="mascot"'>
                <Card className="items-center justify-center gap-6 bg-action-secondary px-6 py-16" shadowSize="4">
                    <div className="animate-spin">
                        <Image src={PEANUTMAN} alt="Peanut" className="h-10 w-10" />
                    </div>
                    <LoadingMessage word={WORDS[index]} className="text-body-m" />
                </Card>
            </Section>

            <Section title="Size and weight options">
                <div className="grid gap-3 md:grid-cols-3">
                    <SizeSwatch label="sm · medium" word={WORDS[index]} className="text-body-s" />
                    <SizeSwatch
                        label={'base · medium (current Loading variant="mascot")'}
                        word={WORDS[index]}
                        className="text-body-m"
                    />
                    <SizeSwatch label="base · semibold" word={WORDS[index]} className="text-body-m-semibold" />
                    <SizeSwatch label="lg · regular" word={WORDS[index]} className="text-body-l" />
                    <SizeSwatch label="lg · bold" word={WORDS[index]} className="text-heading-card" />
                    <SizeSwatch label="xl · bold" word={WORDS[index]} className="text-heading-xs" />
                    <SizeSwatch label="2xl · bold" word={WORDS[index]} className="text-heading-s" />
                    <SizeSwatch label="2xl · extrabold" word={WORDS[index]} className="text-heading-s" />
                    <SizeSwatch
                        label="display (Sniglet) · bold · xl"
                        word={WORDS[index]}
                        className="font-display text-heading-xs"
                    />
                </div>
            </Section>

            <Section title="Controls">
                <Checkbox
                    label="Shuffle order"
                    value={shuffle}
                    onChange={(event) => setShuffle(event.target.checked)}
                />
                <div className="flex flex-wrap gap-2">
                    {WORDS.map((w, i) => (
                        <Button
                            key={w}
                            onClick={() => setIndex(i)}
                            variant={i === index ? 'primary' : 'secondary'}
                            size="small"
                            className="w-auto"
                        >
                            {w}
                        </Button>
                    ))}
                </div>
            </Section>

            <Section title="All words, static">
                <Card className="p-4">
                    <BulletList
                        items={WORDS.map((word) => (
                            <span key={word}>
                                {word}
                                <DotsStatic />
                            </span>
                        ))}
                    />
                </Card>
            </Section>
        </DevPageShell>
    )
}

function LoadingMessage({ word, className = '' }: { word: string; className?: string }) {
    return (
        <div key={word} className={`animate-cycling-fade text-center tabular-nums ${className}`}>
            <span>{word}</span>
            <Dots />
        </div>
    )
}

function SizeSwatch({ label, word, className }: { label: string; word: string; className: string }) {
    return (
        <Card className="items-center justify-center gap-3 px-4 py-8">
            <LoadingMessage word={word} className={className} />
            <div className="text-label-m text-foreground-secondary">{label}</div>
        </Card>
    )
}

function Dots() {
    return (
        <span className="ml-0.5 inline-block">
            <span className="animate-cycling-blink">.</span>
            <span className="animate-cycling-blink" style={{ animationDelay: '0.2s' }}>
                .
            </span>
            <span className="animate-cycling-blink" style={{ animationDelay: '0.4s' }}>
                .
            </span>
        </span>
    )
}

function DotsStatic() {
    return <span className="text-foreground-secondary">...</span>
}
