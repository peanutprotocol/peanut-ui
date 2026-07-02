'use client'

import { PEANUTMAN } from '@/assets/mascot'
import { PAYMENT_LOADING_WORDS } from '@/components/Global/PeanutLoading/words'
import { useEffect, useState } from 'react'

const WORDS = PAYMENT_LOADING_WORDS

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
                    <h1 className="text-2xl font-bold">Loading words preview</h1>
                    <p className="text-sm text-grey-1">
                        Claude-style cycling word with animated dots. Replaces the static "processing..." message during
                        payment loading.
                    </p>
                </header>

                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-grey-1">
                        Production match (same as <code>PeanutLoading</code>)
                    </h2>
                    <div className="flex flex-col items-center justify-center gap-6 rounded-sm border border-n-1 bg-primary-3 px-6 py-16 shadow-[4px_4px_0_0_#000]">
                        <div className="animate-spin">
                            <img src={PEANUTMAN.src} alt="Peanut" className="h-10 w-10" />
                        </div>
                        <LoadingMessage word={WORDS[index]} className="text-base font-medium" />
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-grey-1">
                        Size & weight options (same Roboto font)
                    </h2>
                    <div className="grid gap-3 md:grid-cols-3">
                        <SizeSwatch label="sm · medium" word={WORDS[index]} className="text-sm font-medium" />
                        <SizeSwatch
                            label="base · medium (current PeanutLoading)"
                            word={WORDS[index]}
                            className="text-base font-medium"
                        />
                        <SizeSwatch label="base · semibold" word={WORDS[index]} className="text-base font-semibold" />
                        <SizeSwatch label="lg · semibold" word={WORDS[index]} className="text-lg font-semibold" />
                        <SizeSwatch label="lg · bold" word={WORDS[index]} className="text-lg font-bold" />
                        <SizeSwatch label="xl · bold" word={WORDS[index]} className="text-xl font-bold" />
                        <SizeSwatch label="2xl · bold" word={WORDS[index]} className="text-2xl font-bold" />
                        <SizeSwatch label="2xl · extrabold" word={WORDS[index]} className="text-2xl font-extrabold" />
                        <SizeSwatch
                            label="display (Sniglet) · bold · xl"
                            word={WORDS[index]}
                            className="font-display text-xl font-bold"
                        />
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-grey-1">Controls</h2>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                            shuffle order
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {WORDS.map((w, i) => (
                            <button
                                key={w}
                                onClick={() => setIndex(i)}
                                className={`rounded-sm border border-n-1 px-3 py-1 text-sm transition ${
                                    i === index
                                        ? 'bg-yellow-1 font-bold shadow-[2px_2px_0_0_#000]'
                                        : 'bg-white hover:bg-yellow-1/40'
                                }`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-grey-1">
                        All words, static (for proofreading)
                    </h2>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-n-1 bg-white px-4 py-8">
            <LoadingMessage word={word} className={className} />
            <div className="text-[10px] uppercase tracking-wider text-grey-1">{label}</div>
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
    return <span className="text-grey-1">...</span>
}
