'use client'

import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PAYMENT_LOADING_WORDS } from './words'

const ROTATE_MS = 1800

export default function CyclingLoading({ coverFullScreen = false }: { coverFullScreen?: boolean }) {
    const [index, setIndex] = useState(() => Math.floor(Math.random() * PAYMENT_LOADING_WORDS.length))

    useEffect(() => {
        const id = setInterval(() => {
            setIndex((i) => {
                let next = i
                while (next === i) next = Math.floor(Math.random() * PAYMENT_LOADING_WORDS.length)
                return next
            })
        }, ROTATE_MS)
        return () => clearInterval(id)
    }, [])

    const word = PAYMENT_LOADING_WORDS[index]

    return (
        <div className="w-full flex-col items-center justify-center self-center text-center">
            <div
                className={twMerge(
                    'flex w-full items-center justify-center self-center',
                    coverFullScreen &&
                        'fixed left-0 top-0 z-50 flex h-screen w-full items-center justify-center bg-background'
                )}
            >
                <div className="animate-spin">
                    <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-10" />
                    <span className="sr-only">{word}</span>
                </div>
            </div>
            <div key={word} className="cycling-fade mt-6 self-center text-center font-medium tabular-nums">
                <span>{word}</span>
                <span className="dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                </span>
            </div>
            <style jsx>{`
                @keyframes cyclingFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(2px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .cycling-fade {
                    animation: cyclingFadeIn 240ms ease-out;
                }
                .dots {
                    margin-left: 1px;
                    display: inline-block;
                }
                .dots span {
                    display: inline-block;
                    animation: cyclingBlink 1.4s infinite both;
                }
                .dots span:nth-child(2) {
                    animation-delay: 0.2s;
                }
                .dots span:nth-child(3) {
                    animation-delay: 0.4s;
                }
                @keyframes cyclingBlink {
                    0%,
                    20% {
                        opacity: 0;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    )
}
