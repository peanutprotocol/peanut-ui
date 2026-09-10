'use client'

import { PEANUTMAN } from '@/assets/mascot'
import { PAYMENT_LOADING_WORD_KEYS } from '@/components/Global/Loading/words'
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
        <div className="min-h-screen bg-background">
            <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
                <header className="flex flex-col gap-2">
                    <h1 className="text-heading-s">Loading words preview</h1>
                    <p className="text-body-s text-foreground-secondary">
                        Claude-style cycling word with animated dots. Replaces the static "processing..." message during
                        payment loading.
                    </p>
                </header>

                <section className="flex flex-col gap-3">
                    <h2 className="text-label-l tracking-wider text-foreground-secondary uppercase">
                        Production match (same as <code>Loading variant=&quot;mascot&quot;</code>)
                    </h2>
                    <div className="flex flex-col items-center justify-center gap-6 rounded-sm border border-border-default bg-purple-200 px-6 py-16 shadow-[4px_4px_0_0_#000]">
                        <div className="animate-spin">
                            <Image src={PEANUTMAN} alt="Peanut" className="h-10 w-10" />
                        </div>
                        <LoadingMessage word={WORDS[index]} className="text-body-m" />
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-label-l tracking-wider text-foreground-secondary uppercase">
                        Size & weight options (same Roboto font)
                    </h2>
                    <div className="grid gap-3 md:grid-cols-3">
                        <SizeSwatch label="sm · medium" word={WORDS[index]} className="text-body-s" />
                        <SizeSwatch
                            label={'base · medium (current Loading variant="mascot")'}
                            word={WORDS[index]}
                            className="text-body-m"
                        />
                        <SizeSwatch label="base · semibold" word={WORDS[index]} className="text-body-m-semibold" />
                        <SizeSwatch label="lg · semibold" word={WORDS[index]} className="text-body-l font-semibold" />
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
                </section>

                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-label-l tracking-wider text-foreground-secondary uppercase">Controls</h2>
                        <label className="flex items-center gap-2 text-body-s">
                            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                            shuffle order
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {WORDS.map((w, i) => (
                            <button
                                key={w}
                                onClick={() => setIndex(i)}
                                className={`rounded-sm border border-border-default px-3 py-1 text-label-l transition ${
                                    i === index
                                        ? 'bg-action-secondary shadow-[2px_2px_0_0_#000]'
                                        : 'bg-white hover:bg-action-secondary/40'
                                }`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-label-l tracking-wider text-foreground-secondary uppercase">
                        All words, static (for proofreading)
                    </h2>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-body-s md:grid-cols-3">
                        {WORDS.map((w) => (
                            <li key={w} className="font-medium">
                                {w}
                                <DotsStatic />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-border-default bg-white px-4 py-8">
            <LoadingMessage word={word} className={className} />
            <div className="text-[10px] tracking-wider text-foreground-secondary uppercase">{label}</div>
        </div>
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
