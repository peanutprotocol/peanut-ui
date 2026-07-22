'use client'

import { PeanutWalking } from '@/assets/mascot'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

// ~700KB static file in public/ (sourced from the Internet Archive subway-surfer
// item) — served as-is, never enters the JS bundle or the build graph.
const SUBWAY_SURFERS_MP4 = '/dev-quiz/subway-surfers.mp4'

const MARQUEE_TEXT =
    '🔥 FUNNEL FUNDAMENTALS 🔥 100% FREE 🔥 NO DOWNLOAD 🔥 DEFINITIONS SO HOT THEY NEED KYC 🔥 MOM SAYS I’M COOL 🔥 BEST VIEWED ON A CRT AT 800×600 🔥 SIGN THE GUESTBOOK 🔥 W3C VALIDATED (this is a lie) '

const SPARKLES = ['✨', '⭐', '💫', '🌟', '🥜']

/**
 * Over-the-top 2004-MySpace dressing for the quiz pages. Pure CSS/JS + one
 * static video in public/ + existing mascot assets — nothing added to the
 * bundle beyond this file.
 */
export default function MySpaceChrome({ children }: { children: React.ReactNode }) {
    const [visitors, setVisitors] = useState<number | null>(null)
    const [surfersAlive, setSurfersAlive] = useState(true)
    const [surfersOpen, setSurfersOpen] = useState(true)
    const trailRef = useRef<HTMLDivElement>(null)
    const lastSparkle = useRef(0)

    // odometer spin-up to a proudly fake visitor count
    useEffect(() => {
        const target = 1337420 + Math.floor(Math.random() * 999)
        let current = target - 420
        const tick = window.setInterval(() => {
            current += 21
            if (current >= target) {
                current = target
                window.clearInterval(tick)
            }
            setVisitors(current)
        }, 40)
        return () => window.clearInterval(tick)
    }, [])

    // cursor sparkle trail
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const now = performance.now()
            if (now - lastSparkle.current < 50 || !trailRef.current) return
            lastSparkle.current = now
            if (trailRef.current.childElementCount > 40) trailRef.current.firstElementChild?.remove()
            const s = document.createElement('span')
            s.textContent = SPARKLES[Math.floor(Math.random() * SPARKLES.length)]
            s.className = 'myspace-sparkle'
            s.style.left = `${e.clientX}px`
            s.style.top = `${e.clientY}px`
            trailRef.current.appendChild(s)
            window.setTimeout(() => s.remove(), 700)
        }
        window.addEventListener('pointermove', onMove)
        return () => window.removeEventListener('pointermove', onMove)
    }, [])

    return (
        <div className="relative pb-40">
            {/* keyframes + one-off classes for the chrome (scoped by naming, global by necessity) */}
            <style>{`
                @keyframes myspace-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                @keyframes myspace-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
                @keyframes myspace-rainbow { to { background-position: 200% center; } }
                @keyframes myspace-wiggle { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
                @keyframes myspace-sparkle-fall { to { opacity: 0; transform: translateY(24px) scale(0.4); } }
                @keyframes myspace-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
                @keyframes myspace-road { from { background-position-x: 0; } to { background-position-x: -80px; } }
                @keyframes myspace-runner { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes myspace-obstacles { from { transform: translateX(100vw); } to { transform: translateX(-120px); } }
                @keyframes myspace-pop { 0% { transform: scale(0.3) translateY(6px); opacity: 0; } 40% { transform: scale(1.4) translateY(-4px); opacity: 1; } 100% { transform: scale(1) translateY(-14px); opacity: 0; } }
                @keyframes myspace-levelup { 0% { transform: scale(0.2) rotate(-6deg); opacity: 0; } 20% { transform: scale(1.1) rotate(2deg); opacity: 1; } 80% { transform: scale(1) rotate(0); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
                .myspace-marquee-track { display: inline-block; white-space: nowrap; animation: myspace-marquee 14s linear infinite; }
                .myspace-blink { animation: myspace-blink 0.9s step-end infinite; }
                .myspace-rainbow { background: linear-gradient(90deg, #ff004c, #ff9900, #ffe600, #2bd12b, #00b3ff, #b967ff, #ff004c); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: myspace-rainbow 2.5s linear infinite; }
                .myspace-comic { font-family: 'Comic Sans MS', 'Comic Neue', cursive; }
                .myspace-sticker { animation: myspace-wiggle 1.6s ease-in-out infinite; }
                .myspace-sparkle { position: fixed; z-index: 60; pointer-events: none; font-size: 14px; transform: translate(-50%, -50%); animation: myspace-sparkle-fall 0.7s ease-out forwards; }
                .myspace-shake-it { animation: myspace-shake 0.45s; }
                .myspace-points-pop { position: absolute; right: 0; top: -4px; font-weight: 800; pointer-events: none; animation: myspace-pop 0.9s ease-out forwards; }
                .myspace-levelup-banner { animation: myspace-levelup 1.6s ease-in-out forwards; }
                .myspace-road { background: repeating-linear-gradient(90deg, #333 0 30px, #555 30px 40px, #333 40px 70px, #ffc900 70px 80px); animation: myspace-road 0.6s linear infinite; }
                .myspace-runner { animation: myspace-runner 0.5s ease-in-out infinite; }
                .myspace-obstacles { animation: myspace-obstacles 6s linear infinite; }
            `}</style>

            <div ref={trailRef} aria-hidden />

            {/* top marquee */}
            <div className="myspace-comic overflow-hidden border-b-2 border-n-1 bg-black py-1 text-xs font-bold text-white">
                <div className="myspace-marquee-track">
                    <span>{MARQUEE_TEXT}</span>
                    <span aria-hidden>{MARQUEE_TEXT}</span>
                </div>
            </div>

            {/* corner stickers */}
            <div className="pointer-events-none absolute left-1 top-8 z-20 rotate-[-8deg]">
                <span className="myspace-sticker myspace-comic inline-block rounded-sm border-2 border-n-1 bg-yellow-1 px-2 py-0.5 text-[10px] font-bold shadow-md">
                    ★ HOT NEW QUIZ ★
                </span>
            </div>
            <div className="pointer-events-none absolute right-1 top-8 z-20 rotate-[7deg]">
                <span className="myspace-blink myspace-comic inline-block rounded-sm border-2 border-n-1 bg-primary-1 px-2 py-0.5 text-[10px] font-bold shadow-md">
                    🚧 UNDER CONSTRUCTION 🚧
                </span>
            </div>

            {children}

            {/* visitor counter + webring */}
            <div className="myspace-comic mx-4 mb-4 flex flex-col items-center gap-2 rounded-sm border-2 border-n-1 bg-black p-3 text-center text-xs text-white">
                <div>
                    ☆ﾟ You are visitor{' '}
                    <span className="rounded-sm bg-green-1 px-1 font-mono font-bold text-black">
                        {visitors === null ? '……' : visitors.toLocaleString()}
                    </span>{' '}
                    ﾟ☆
                </div>
                <div className="myspace-blink font-bold text-yellow-1">~*~ tHaNkS 4 vIsItInG mY qUiZ pAgE ~*~</div>
                <div className="flex gap-3 underline">
                    <Link href="/dev/ds">← prev</Link>
                    <span className="no-underline">PEANUT WEBRING</span>
                    <Link href="/dev/leaderboard">next →</Link>
                </div>
                <a className="underline" href="mailto:konrad@peanut.me?subject=sign%20my%20guestbook">
                    📖 sign my guestbook
                </a>
            </div>

            {/* subway surfers retention engine */}
            {surfersOpen && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-n-1 bg-black">
                    <div className="myspace-comic flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-white">
                        <span className="myspace-blink">
                            🚇 SUBWAY SURFERS — gameplay for the attention-span impaired
                        </span>
                        <button type="button" aria-label="Close subway surfers" onClick={() => setSurfersOpen(false)}>
                            ✖
                        </button>
                    </div>
                    <div className="relative h-24 overflow-hidden">
                        {surfersAlive ? (
                            <video
                                src={SUBWAY_SURFERS_MP4}
                                className="h-full w-full object-cover"
                                autoPlay
                                muted
                                loop
                                playsInline
                                onError={() => setSurfersAlive(false)}
                            />
                        ) : (
                            /* fallback: peanut edition, all local assets */
                            <div className="myspace-road relative h-full">
                                <div className="myspace-obstacles absolute bottom-6 text-2xl">🚃 🚧 🛹 🚧 🚃</div>
                                <div className="myspace-runner absolute bottom-1 left-8">
                                    <Image
                                        src={PeanutWalking.src}
                                        unoptimized
                                        alt="Peanut surfing the subway"
                                        width={64}
                                        height={64}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
