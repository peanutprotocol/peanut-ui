'use client'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import Image from 'next/image'
import peanutLogo from '@/assets/peanut/peanutman-logo.svg'
import { useState, useEffect, useCallback, useRef } from 'react'

interface PioneerCard3DProps {
    className?: string
}

type CardVariant =
    | 'dark'
    | 'gold'
    | 'holographic'
    | 'retro80s'
    | 'vaporwave'
    | 'pixel'
    | 'newspaper'
    | 'blueprint'
    | 'lava'
    | 'galaxy'
    | 'glitch'
    | 'handdrawn'
    | 'terminal'
    | 'minecraft'
    | 'gta'
    | 'zelda'
    | 'cyberpunk'
    | 'pokemon'
    | 'plasma'
    | 'crt'
    | 'fire'
    | 'underwater'
    | 'matrix'
    | 'disco'

const variantOrder: CardVariant[] = [
    'dark',
    'gold',
    'holographic',
    'retro80s',
    'vaporwave',
    'pixel',
    'newspaper',
    'blueprint',
    'lava',
    'galaxy',
    'glitch',
    'handdrawn',
    'terminal',
    'minecraft',
    'gta',
    'zelda',
    'cyberpunk',
    'pokemon',
    'plasma',
    'crt',
    'fire',
    'underwater',
    'matrix',
    'disco',
]

const PioneerCard3D = ({ className }: PioneerCard3DProps) => {
    const [currentVariantIndex, setCurrentVariantIndex] = useState(0)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const rotateX = useTransform(y, [-100, 100], [12, -12])
    const rotateY = useTransform(x, [-100, 100], [-12, 12])

    const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 25 })
    const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 25 })

    const currentVariant = variantOrder[currentVariantIndex]

    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
        }
        timerRef.current = setInterval(() => {
            setIsTransitioning(true)
            setTimeout(() => {
                setCurrentVariantIndex((prev) => (prev + 1) % variantOrder.length)
                setIsTransitioning(false)
            }, 150)
        }, 4000)
    }, [])

    const goNext = useCallback(() => {
        setIsTransitioning(true)
        setTimeout(() => {
            setCurrentVariantIndex((prev) => (prev + 1) % variantOrder.length)
            setIsTransitioning(false)
        }, 150)
        resetTimer()
    }, [resetTimer])

    const goPrev = useCallback(() => {
        setIsTransitioning(true)
        setTimeout(() => {
            setCurrentVariantIndex((prev) => (prev - 1 + variantOrder.length) % variantOrder.length)
            setIsTransitioning(false)
        }, 150)
        resetTimer()
    }, [resetTimer])

    useEffect(() => {
        resetTimer()
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [resetTimer])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        x.set(e.clientX - centerX)
        y.set(e.clientY - centerY)

        const relX = (e.clientX - rect.left) / rect.width
        const relY = (e.clientY - rect.top) / rect.height
        setMousePosition({ x: relX, y: relY })
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
        setMousePosition({ x: 0.5, y: 0.5 })
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const isLeftHalf = clickX < rect.width / 2

        if (isLeftHalf) {
            goPrev()
        } else {
            goNext()
        }
    }

    const renderCardContent = () => {
        switch (currentVariant) {
            case 'dark':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="rounded-full bg-secondary-1 px-3 py-1 text-xs font-bold text-n-1">
                                PIONEER
                            </span>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white">PEANUT CARD</p>
                            <p className="mt-1 font-mono text-sm tracking-widest text-white/50">•••• •••• •••• ••••</p>
                        </div>
                    </div>
                )

            case 'gold':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-n-1/10 shadow-inner">
                                <Image src={peanutLogo} alt="Peanut" width={32} height={32} />
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-medium uppercase tracking-widest text-n-1/60">
                                    Status
                                </span>
                                <span className="font-serif text-sm font-bold italic text-n-1">Pioneer</span>
                            </div>
                        </div>
                        <div>
                            <p className="font-serif text-2xl font-bold italic text-n-1">Peanut Card</p>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-6 w-10 rounded bg-gradient-to-br from-n-1/20 to-n-1/5" />
                                <p className="font-mono text-xs tracking-[0.3em] text-n-1/70">XXXX XXXX XXXX</p>
                            </div>
                        </div>
                    </div>
                )

            case 'holographic':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-3 py-1 text-xs font-bold text-white">
                                PIONEER
                            </span>
                        </div>
                        <div>
                            <p className="bg-gradient-to-r from-pink-300 via-white to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
                                PEANUT CARD
                            </p>
                            <p className="mt-1 font-mono text-sm tracking-widest text-white/60">•••• •••• •••• ••••</p>
                        </div>
                    </div>
                )

            case 'retro80s':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between p-2">
                        <div className="flex items-start justify-between">
                            <div className="relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-[#ff00ff] to-[#00ffff] opacity-75 blur-sm" />
                                <div className="relative flex h-12 w-12 items-center justify-center bg-black">
                                    <Image src={peanutLogo} alt="Peanut" width={32} height={32} />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="h-1 w-16 bg-[#ff00ff]" />
                                <div className="h-1 w-12 bg-[#00ffff]" />
                                <div className="h-1 w-8 bg-[#ffff00]" />
                            </div>
                        </div>
                        <div>
                            <p
                                className="text-2xl font-black uppercase tracking-tight text-[#ff00ff]"
                                style={{
                                    textShadow: '2px 2px 0 #00ffff, 4px 4px 0 #ffff00',
                                }}
                            >
                                PEANUT
                            </p>
                            <p className="mt-1 font-mono text-xs text-[#00ffff]">██████ ██████ ██████ ██████</p>
                            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[#ff00ff]/80">
                                ★ PIONEER EDITION ★
                            </p>
                        </div>
                    </div>
                )

            case 'vaporwave':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} className="opacity-80" />
                            </div>
                            <span className="font-mono text-xs text-[#ff71ce]">パイオニア</span>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold tracking-[0.3em] text-[#01cdfe]">ＰＥＡＮＵＴ</p>
                            <p className="mt-1 text-lg tracking-[0.5em] text-[#ff71ce]">ＣＡＲＤ</p>
                            <p className="mt-3 font-mono text-[10px] tracking-widest text-[#05ffa1]/60">
                                ２０２６ · ＡＥＳＴＨＥＴＩＣ
                            </p>
                        </div>
                        <div className="flex justify-center gap-2">
                            <span className="text-lg">🌴</span>
                            <span className="text-lg">🌊</span>
                            <span className="text-lg">🌅</span>
                        </div>
                    </div>
                )

            case 'pixel':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div
                                className="flex h-10 w-10 items-center justify-center bg-[#5c4033]"
                                style={{ imageRendering: 'pixelated' }}
                            >
                                <span className="text-2xl">🥜</span>
                            </div>
                            <div className="border-2 border-[#f7d354] bg-[#5c4033] px-2 py-0.5">
                                <span className="font-mono text-xs font-bold text-[#f7d354]">LVL 99</span>
                            </div>
                        </div>
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <div className="h-2 w-full bg-[#333]">
                                    <div className="h-full w-[85%] bg-[#4ade80]" />
                                </div>
                                <span className="font-mono text-[10px] text-[#4ade80]">HP</span>
                            </div>
                            <p className="font-mono text-lg font-bold uppercase text-[#f7d354]">PEANUT CARD</p>
                            <p className="mt-1 font-mono text-xs text-[#8b8b8b]">▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓</p>
                            <p className="mt-1 font-mono text-[10px] text-[#f7d354]/60">+50 ATK · +30 DEF · PIONEER</p>
                        </div>
                    </div>
                )

            case 'newspaper':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="border-b-2 border-double border-n-1 pb-2">
                            <p className="text-center font-serif text-2xl font-black uppercase tracking-tight text-n-1">
                                The Peanut Times
                            </p>
                            <p className="text-center font-serif text-[8px] italic text-n-1/60">
                                Est. 2024 · "All the nuts fit to print"
                            </p>
                        </div>
                        <div className="flex-1 py-2">
                            <p className="font-serif text-sm font-bold uppercase text-n-1">
                                BREAKING: Pioneer Status Confirmed!
                            </p>
                            <p
                                className="mt-1 text-[9px] leading-tight text-n-1/80"
                                style={{ fontFamily: 'Georgia, serif', columns: 2, columnGap: '8px' }}
                            >
                                Local resident gains exclusive early access to revolutionary spending card. Experts say
                                this is unprecedented. More on page 4...
                            </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-n-1/30 pt-1">
                            <p className="font-mono text-[8px] text-n-1/50">Vol. MMXXVI No. 001</p>
                            <p className="font-mono text-[8px] text-n-1/50">$0.25</p>
                        </div>
                    </div>
                )

            case 'blueprint':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between font-mono">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-white/60">
                                    Project: Peanut Card
                                </p>
                                <p className="text-[8px] text-white/40">Rev. 2.0 | Scale 1:1</p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center border border-dashed border-white/30">
                                <Image src={peanutLogo} alt="Peanut" width={20} height={20} className="opacity-60" />
                            </div>
                        </div>
                        <div className="relative border border-white/20 p-3">
                            <div className="absolute -left-1 -top-1 h-2 w-2 border-l border-t border-white/40" />
                            <div className="absolute -right-1 -top-1 h-2 w-2 border-r border-t border-white/40" />
                            <div className="absolute -bottom-1 -left-1 h-2 w-2 border-b border-l border-white/40" />
                            <div className="absolute -bottom-1 -right-1 h-2 w-2 border-b border-r border-white/40" />
                            <p className="text-center text-xs uppercase tracking-[0.3em] text-white/80">PIONEER</p>
                            <p className="mt-1 text-center text-[8px] text-white/50">← 85.6mm → × ← 53.98mm →</p>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="text-[8px] text-white/40">
                                <p>Approved: ✓</p>
                                <p>Date: 2026.01</p>
                            </div>
                            <div className="border border-white/30 px-2 py-0.5 text-[8px] text-white/60">
                                CLASSIFIED
                            </div>
                        </div>
                    </div>
                )

            case 'lava':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-900/50">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="rounded bg-orange-500/80 px-2 py-0.5 text-xs font-bold text-white">
                                🔥 HOT
                            </span>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-orange-100">PEANUT CARD</p>
                            <p className="mt-1 font-mono text-sm tracking-widest text-orange-300/60">
                                •••• •••• •••• ••••
                            </p>
                            <p className="mt-2 text-[10px] uppercase tracking-widest text-orange-400/80">
                                Forged in fire · Pioneer
                            </p>
                        </div>
                    </div>
                )

            case 'galaxy':
                return (
                    <div className="relative z-20 flex h-full flex-col items-center justify-center text-center">
                        <div className="absolute right-3 top-3">
                            <span className="text-2xl">✨</span>
                        </div>
                        <div className="absolute left-4 top-4">
                            <span className="text-sm">⭐</span>
                        </div>
                        <div className="absolute bottom-6 left-6">
                            <span className="text-xs">💫</span>
                        </div>
                        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                            <Image src={peanutLogo} alt="Peanut" width={36} height={36} />
                        </div>
                        <p className="bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-2xl font-bold text-transparent">
                            PEANUT
                        </p>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Card</p>
                        <p className="mt-3 text-[10px] text-purple-300/80">★ PIONEER · COSMIC EDITION ★</p>
                    </div>
                )

            case 'glitch':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="relative flex h-10 w-10 items-center justify-center">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="border border-[#00ff00] bg-black/50 px-2 py-0.5 font-mono text-xs text-[#00ff00]">
                                ERR_PIONEER
                            </span>
                        </div>
                        <div>
                            <p className="glitch-text text-xl font-bold text-white" data-text="PEANUT CARD">
                                PEANUT CARD
                            </p>
                            <p className="mt-1 font-mono text-sm text-[#00ff00]/70">████ ████ ████ ████</p>
                            <p className="text-red-500 mt-1 font-mono text-[10px]">WARNING: SYSTEM_UNSTABLE</p>
                        </div>
                    </div>
                )

            case 'handdrawn':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div
                                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-n-1"
                                style={{ borderStyle: 'dashed' }}
                            >
                                <span className="text-2xl">🥜</span>
                            </div>
                            <div
                                className="rotate-3 border-2 border-n-1 bg-secondary-1 px-2 py-1"
                                style={{ borderRadius: '2px 8px 2px 8px' }}
                            >
                                <span style={{ fontFamily: 'Comic Sans MS, cursive' }} className="font-bold text-n-1">
                                    pioneer!
                                </span>
                            </div>
                        </div>
                        <div>
                            <p
                                className="-rotate-1 text-2xl font-bold text-n-1"
                                style={{ fontFamily: 'Comic Sans MS, cursive' }}
                            >
                                Peanut Card
                            </p>
                            <div className="mt-2 flex gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="h-4 w-8 border-2 border-n-1/60"
                                        style={{
                                            borderRadius: '2px 4px 3px 5px',
                                            transform: `rotate(${(i - 2) * 2}deg)`,
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="mt-2 text-sm text-n-1/70" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                                (this is totally official)
                            </p>
                        </div>
                    </div>
                )

            case 'terminal':
                return (
                    <div className="relative z-20 flex h-full flex-col font-mono text-[#00ff00]">
                        <div className="mb-2 flex items-center gap-2 border-b border-[#00ff00]/30 pb-2">
                            <div className="h-2 w-2 rounded-full bg-[#ff5f56]" />
                            <div className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
                            <div className="h-2 w-2 rounded-full bg-[#27ca40]" />
                            <span className="ml-2 text-[10px] text-[#00ff00]/60">peanut@card:~</span>
                        </div>
                        <div className="flex-1 space-y-1 text-[11px]">
                            <p>
                                <span className="text-[#00ff00]/60">$</span> cat /status
                            </p>
                            <p className="text-[#27ca40]">PIONEER_MODE=ACTIVE</p>
                            <p>
                                <span className="text-[#00ff00]/60">$</span> whoami
                            </p>
                            <p>peanut_cardholder</p>
                            <p>
                                <span className="text-[#00ff00]/60">$</span> echo $CARD_NUMBER
                            </p>
                            <p className="text-[#00ff00]/50">**** **** **** ****</p>
                            <p className="animate-pulse">
                                <span className="text-[#00ff00]/60">$</span>{' '}
                                <span className="bg-[#00ff00] text-black">▌</span>
                            </p>
                        </div>
                    </div>
                )

            case 'minecraft':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        {/* Hotbar style top */}
                        <div className="flex items-center justify-between">
                            <div className="minecraft-slot flex h-12 w-12 items-center justify-center">
                                <span className="text-2xl" style={{ imageRendering: 'pixelated' }}>
                                    🥜
                                </span>
                            </div>
                            <div className="flex gap-1">
                                {/* Mini hearts */}
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="h-3 w-3 bg-[#ff0000]"
                                        style={{
                                            clipPath:
                                                'polygon(50% 0%, 65% 15%, 100% 15%, 100% 35%, 50% 100%, 0% 35%, 0% 15%, 35% 15%)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        {/* Item tooltip style */}
                        <div className="minecraft-tooltip">
                            <p className="text-lg font-bold text-[#FFFF55]">Peanut Card</p>
                            <p className="text-xs text-[#AA00AA]">EPIC</p>
                            <div className="mt-2 space-y-0.5 text-[11px]">
                                <p className="text-[#555555]">When held:</p>
                                <p className="text-[#00AA00]"> +∞ Payment Speed</p>
                                <p className="text-[#00AA00]"> +100 Pioneer Points</p>
                                <p className="text-[#5555FF]"> Grants early access</p>
                            </div>
                        </div>
                        {/* XP bar */}
                        <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-[#000000] p-[2px]">
                                <div className="h-full w-[72%] bg-[#80FF20]" />
                            </div>
                            <span className="text-xs font-bold text-[#80FF20]">72</span>
                        </div>
                    </div>
                )

            case 'gta':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <Image src={peanutLogo} alt="Peanut" width={36} height={36} />
                            <div className="text-right">
                                <p className="text-xs font-black uppercase tracking-wider text-white">MAZE BANK</p>
                                <p className="text-[10px] text-white/60">Los Santos</p>
                            </div>
                        </div>
                        <div>
                            <p
                                className="text-3xl font-black uppercase italic text-white"
                                style={{
                                    fontFamily: 'Impact, sans-serif',
                                    letterSpacing: '-1px',
                                    textShadow: '2px 2px 0 #000',
                                }}
                            >
                                PEANUT
                            </p>
                            <div className="mt-2 flex items-center gap-4">
                                <div>
                                    <p className="text-[10px] uppercase text-white/50">Balance</p>
                                    <p className="text-lg font-bold text-[#2ecc71]" style={{ fontFamily: 'monospace' }}>
                                        $999,999
                                    </p>
                                </div>
                                <div className="h-8 w-px bg-white/20" />
                                <div>
                                    <p className="text-[10px] uppercase text-white/50">Status</p>
                                    <p className="text-sm font-bold text-[#f39c12]">PIONEER</p>
                                </div>
                            </div>
                        </div>
                        {/* GTA-style wanted stars */}
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <span key={i} className={i <= 3 ? 'text-white' : 'text-white/30'}>
                                    ★
                                </span>
                            ))}
                            <span className="ml-2 text-[10px] text-white/50">WANTED LEVEL: PIONEER</span>
                        </div>
                    </div>
                )

            case 'zelda':
                return (
                    <div className="relative z-20 flex h-full flex-col items-center justify-between py-2 text-center">
                        {/* Hearts row */}
                        <div className="flex w-full items-center justify-between px-2">
                            <span className="text-lg">🛡️</span>
                            <div className="flex gap-0.5">
                                {[1, 2, 3].map((i) => (
                                    <span key={i} className="text-sm">
                                        ❤️
                                    </span>
                                ))}
                                {[1, 2].map((i) => (
                                    <span key={i} className="text-sm opacity-30">
                                        🖤
                                    </span>
                                ))}
                            </div>
                            <span className="text-lg">⚔️</span>
                        </div>
                        {/* Center medallion */}
                        <div>
                            <div className="zelda-medallion mx-auto mb-2 flex h-16 w-16 items-center justify-center">
                                <span className="text-3xl">🥜</span>
                            </div>
                            <p className="font-serif text-xl font-bold tracking-wider text-[#C8A832]">PEANUT CARD</p>
                            <p className="mt-1 text-xs text-[#7CB342]">⟡ Pioneer&apos;s Blessing ⟡</p>
                        </div>
                        {/* Triforce hint */}
                        <div className="flex items-center gap-2">
                            <span className="text-[#C8A832]">▲</span>
                            <p className="text-[10px] uppercase tracking-widest text-[#C8A832]/80">
                                It&apos;s dangerous to go alone!
                            </p>
                            <span className="text-[#C8A832]">▲</span>
                        </div>
                    </div>
                )

            case 'cyberpunk':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="relative">
                                <div className="h-12 w-12 border-l-2 border-t-2 border-[#00f0ff] bg-black/50 p-2">
                                    <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-[#ff003c]" />
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-[10px] text-[#00f0ff]">ARASAKA_VERIFIED</p>
                                <p className="font-mono text-xs font-bold text-[#ff003c]">PIONEER//2077</p>
                            </div>
                        </div>
                        <div className="border-l-2 border-[#fcee0a] pl-3">
                            <p
                                className="text-2xl font-black uppercase text-[#fcee0a]"
                                style={{ letterSpacing: '-1px' }}
                            >
                                PEANUT
                            </p>
                            <p className="text-sm uppercase tracking-widest text-white/60">CREDCHIP</p>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="font-mono text-[10px] text-[#00f0ff]/70">
                                <p>ID: NC-2077-XXXX</p>
                                <p>CLASS: PREMIUM</p>
                            </div>
                            <div className="flex gap-1">
                                {[4, 6, 5, 3, 7, 4].map((h, i) => (
                                    <div
                                        key={i}
                                        className="w-1"
                                        style={{
                                            height: `${h * 4}px`,
                                            background: i % 2 === 0 ? '#ff003c' : i % 3 === 0 ? '#fcee0a' : '#00f0ff',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )

            case 'pokemon':
                return (
                    <div className="relative z-20 flex h-full flex-col">
                        <div className="flex items-center justify-between">
                            <p className="text-lg font-bold text-n-1">Peanut Card</p>
                            <div className="flex items-center gap-1">
                                <span className="text-sm">HP</span>
                                <span className="text-xl font-bold text-n-1">100</span>
                                <span className="rounded-full bg-[#F8D030] px-2 py-0.5 text-[10px] font-bold">⚡</span>
                            </div>
                        </div>
                        <div className="pokemon-frame my-2 flex flex-1 items-center justify-center">
                            <div className="flex flex-col items-center">
                                <span className="text-4xl">🥜</span>
                                <p className="mt-1 text-[10px] italic text-n-1/60">
                                    Pioneer Pokémon · Ht: 2&apos;0&quot; · Wt: 0.5 lbs
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-[#F8D030] px-1 text-[10px] font-bold">⚡</span>
                                <span className="text-xs font-bold">Quick Pay</span>
                                <span className="ml-auto text-sm font-bold">40</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-[#F8D030] px-1 text-[10px] font-bold">⚡⚡</span>
                                <span className="text-xs font-bold">Pioneer Blast</span>
                                <span className="ml-auto text-sm font-bold">80</span>
                            </div>
                        </div>
                        <div className="mt-1 flex justify-between text-[8px] text-n-1/50">
                            <span>weakness: 🔥 ×2</span>
                            <span>resistance: 💧 -20</span>
                            <span>retreat: ⚪</span>
                        </div>
                    </div>
                )

            case 'plasma':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                                PIONEER
                            </span>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white">PEANUT CARD</p>
                            <p className="mt-1 font-mono text-sm tracking-widest text-white/50">•••• •••• •••• ••••</p>
                        </div>
                    </div>
                )

            case 'crt':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between font-mono">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} className="opacity-90" />
                            </div>
                            <span className="text-xs text-[#33ff33]">[PIONEER]</span>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-[#33ff33]">PEANUT CARD</p>
                            <p className="mt-2 text-sm text-[#33ff33]/70">════════════════════</p>
                            <p className="text-xs text-[#33ff33]/50">CARD NO: XXXX-XXXX-XXXX</p>
                        </div>
                        <div className="flex justify-between text-[10px] text-[#33ff33]/60">
                            <span>1984 RETRO SYS</span>
                            <span>V2.0</span>
                        </div>
                    </div>
                )

            case 'fire':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="fire-logo flex h-12 w-12 items-center justify-center rounded-full">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} style={{ width: 'auto', height: 'auto' }} />
                            </div>
                            <span className="to-red-500 rounded bg-gradient-to-r from-yellow-500 via-orange-500 px-3 py-1 text-xs font-bold text-white">
                                🔥 BLAZING
                            </span>
                        </div>
                        <div className="text-center">
                            <p className="fire-text text-3xl font-black uppercase text-transparent">PEANUT</p>
                            <p className="text-sm uppercase tracking-widest text-orange-200">CARD</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-orange-300/80">
                            <span className="text-2xl">🔥</span>
                            <span className="text-[10px] uppercase tracking-widest">Pioneer · Inferno Edition</span>
                            <span className="text-2xl">🔥</span>
                        </div>
                    </div>
                )

            case 'underwater':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-900/50">
                                <Image src={peanutLogo} alt="Peanut" width={28} height={28} className="opacity-80" />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-lg">🐠</span>
                                <span className="text-xs font-medium text-cyan-200">DEEP SEA</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-cyan-100">PEANUT CARD</p>
                            <p className="mt-1 text-sm text-cyan-300/60">~ ~ ~ ~ ~ ~ ~ ~</p>
                            <p className="mt-2 text-xs text-cyan-200/50">🐚 Pioneer · Aquatic Edition 🐚</p>
                        </div>
                        <div className="flex justify-center gap-3 text-2xl">
                            <span className="animate-bounce" style={{ animationDelay: '0s' }}>
                                🫧
                            </span>
                            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>
                                🫧
                            </span>
                            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>
                                🫧
                            </span>
                        </div>
                    </div>
                )

            case 'matrix':
                return (
                    <div className="relative z-20 flex h-full flex-col justify-between font-mono">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center border border-[#00ff00]/30">
                                <Image
                                    src={peanutLogo}
                                    alt="Peanut"
                                    width={28}
                                    height={28}
                                    style={{
                                        filter: 'brightness(0) invert(1) sepia(1) saturate(10000%) hue-rotate(85deg)',
                                    }}
                                />
                            </div>
                            <span className="text-xs text-[#00ff00]">THE_MATRIX</span>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-[#00ff00]">PEANUT CARD</p>
                            <p className="mt-2 text-xs text-[#00ff00]/60">Wake up, Pioneer...</p>
                            <p className="text-xs text-[#00ff00]/60">Follow the white rabbit.</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#00ff00]/50">
                            <span>RED PILL</span>
                            <span>💊</span>
                            <span>BLUE PILL</span>
                        </div>
                    </div>
                )

            case 'disco':
                return (
                    <div className="relative z-20 flex h-full flex-col items-center justify-between py-2 text-center">
                        <div className="flex w-full items-center justify-between">
                            <span className="text-2xl">🪩</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-white">Studio 54</span>
                            <span className="text-2xl">🪩</span>
                        </div>
                        <div>
                            <div className="disco-ball mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full">
                                <Image src={peanutLogo} alt="Peanut" width={32} height={32} />
                            </div>
                            <p className="disco-text text-2xl font-black uppercase">PEANUT</p>
                            <p className="text-lg font-bold text-white/80">CARD</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💃</span>
                            <span className="text-xs uppercase tracking-widest text-pink-300">
                                Pioneer · Groovy Edition
                            </span>
                            <span className="text-xl">🕺</span>
                        </div>
                    </div>
                )

            default:
                return null
        }
    }

    const getCardStyles = (): React.CSSProperties => {
        const baseStyles: React.CSSProperties = {
            rotateX: springRotateX as unknown as number,
            rotateY: springRotateY as unknown as number,
            transformStyle: 'preserve-3d',
            opacity: isTransitioning ? 0.7 : 1,
            scale: isTransitioning ? 0.98 : 1,
            '--mouse-x': `${mousePosition.x * 100}%`,
            '--mouse-y': `${mousePosition.y * 100}%`,
        } as React.CSSProperties

        return baseStyles
    }

    const getCardClasses = (): string => {
        const base =
            'relative h-52 w-80 cursor-pointer overflow-hidden rounded-xl p-6 shadow-lg md:h-60 md:w-96 card-transition'

        const variantClasses: Record<CardVariant, string> = {
            dark: 'border-2 border-n-1 bg-gradient-to-br from-[#161616] via-[#2d2d2d] to-[#161616]',
            gold: 'border-2 border-n-1 bg-gradient-to-br from-[#FFC900] via-[#FFE066] to-[#F5B800]',
            holographic:
                'border-2 border-white/20 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] holo-card',
            retro80s: 'border-4 border-[#ff00ff] bg-black retro-card',
            vaporwave:
                'border-2 border-[#ff71ce] bg-gradient-to-b from-[#1a1a2e] via-[#2d1b4e] to-[#1a1a2e] vapor-card',
            pixel: 'border-4 border-[#5c4033] bg-[#2a1f14] pixel-card',
            newspaper: 'border border-n-1 bg-[#f5f5dc] newspaper-card',
            blueprint: 'border border-white/30 bg-[#1e3a5f] blueprint-card',
            lava: 'border-2 border-orange-900 bg-gradient-to-b from-[#1a0a0a] to-[#2d1a1a] lava-card',
            galaxy: 'border border-purple-500/30 bg-gradient-to-b from-[#0a0015] via-[#1a0030] to-[#0a0015] galaxy-card',
            glitch: 'border-2 border-[#00ff00]/50 bg-[#0a0a0a] glitch-card',
            handdrawn: 'border-[3px] border-n-1 bg-[#fffef0] handdrawn-card',
            terminal: 'border border-[#00ff00]/50 bg-[#0d0d0d] terminal-card',
            minecraft: 'border-4 border-[#373737] bg-[#8B8B8B] minecraft-card',
            gta: 'border-2 border-[#2ecc71] bg-gradient-to-br from-[#1a1a2e] via-[#2d2d4e] to-[#1a1a2e] gta-card',
            zelda: 'border-4 border-[#C8A832] bg-gradient-to-b from-[#1a472a] via-[#2d5a3a] to-[#1a472a] zelda-card',
            cyberpunk: 'border border-[#00f0ff] bg-[#0a0a0a] cyberpunk-card',
            pokemon: 'border-4 border-[#F8D030] bg-[#FFF8DC] pokemon-card rounded-2xl',
            plasma: 'border border-white/20 plasma-card',
            crt: 'border-4 border-[#1a1a1a] bg-[#0a0a0a] crt-card',
            fire: 'border-2 border-orange-600 bg-gradient-to-b from-[#1a0505] via-[#2d0a0a] to-[#1a0505] fire-card',
            underwater:
                'border-2 border-cyan-700 bg-gradient-to-b from-[#001a2c] via-[#003344] to-[#001a2c] underwater-card',
            matrix: 'border border-[#00ff00]/30 bg-[#000500] matrix-card',
            disco: 'border-2 border-pink-500 bg-gradient-to-b from-[#1a0a1a] via-[#2d1a2d] to-[#1a0a1a] disco-card',
        }

        return `${base} ${variantClasses[currentVariant]}`
    }

    return (
        <>
            <style jsx global>{`
                /* ===== HOLOGRAPHIC ===== */
                @keyframes holoShift {
                    0%,
                    100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }

                .holo-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        125deg,
                        transparent 0%,
                        rgba(255, 0, 128, 0.3) 15%,
                        rgba(128, 0, 255, 0.2) 30%,
                        transparent 45%,
                        rgba(0, 255, 255, 0.3) 60%,
                        rgba(255, 0, 128, 0.2) 75%,
                        transparent 100%
                    );
                    background-size: 300% 300%;
                    animation: holoShift 3s ease-in-out infinite;
                    border-radius: 0.75rem;
                    pointer-events: none;
                    z-index: 10;
                }

                /* ===== RETRO 80s ===== */
                @keyframes scanlines {
                    0% {
                        background-position: 0 0;
                    }
                    100% {
                        background-position: 0 100%;
                    }
                }

                .retro-card {
                    box-shadow:
                        0 0 10px #ff00ff,
                        0 0 20px #ff00ff,
                        0 0 30px #00ffff,
                        inset 0 0 20px rgba(255, 0, 255, 0.1);
                }

                .retro-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0, 0, 0, 0.3) 2px,
                        rgba(0, 0, 0, 0.3) 4px
                    );
                    pointer-events: none;
                    z-index: 15;
                    animation: scanlines 10s linear infinite;
                }

                /* ===== VAPORWAVE ===== */
                .vapor-card::before {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 60%;
                    background:
                        linear-gradient(to top, rgba(255, 113, 206, 0.15) 0%, transparent 100%),
                        repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 2px,
                            rgba(1, 205, 254, 0.05) 2px,
                            rgba(1, 205, 254, 0.05) 4px
                        );
                    pointer-events: none;
                    z-index: 5;
                }

                /* ===== PIXEL ===== */
                .pixel-card {
                    image-rendering: pixelated;
                    box-shadow:
                        4px 4px 0 #3d2817,
                        8px 8px 0 #2a1f14;
                }

                .pixel-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, transparent 50%, rgba(0, 0, 0, 0.1) 50%),
                        linear-gradient(transparent 50%, rgba(0, 0, 0, 0.1) 50%);
                    background-size: 4px 4px;
                    pointer-events: none;
                    z-index: 10;
                }

                /* ===== NEWSPAPER ===== */
                .newspaper-card {
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent,
                        transparent 23px,
                        rgba(0, 0, 0, 0.05) 23px,
                        rgba(0, 0, 0, 0.05) 24px
                    );
                }

                /* ===== BLUEPRINT ===== */
                .blueprint-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 20px 20px;
                    pointer-events: none;
                    z-index: 5;
                }

                /* ===== LAVA ===== */
                @keyframes lavaBlob1 {
                    0%,
                    100% {
                        transform: translate(0, 0) scale(1);
                    }
                    25% {
                        transform: translate(20px, -30px) scale(1.2);
                    }
                    50% {
                        transform: translate(-10px, -60px) scale(0.8);
                    }
                    75% {
                        transform: translate(-30px, -20px) scale(1.1);
                    }
                }

                @keyframes lavaBlob2 {
                    0%,
                    100% {
                        transform: translate(0, 0) scale(1);
                    }
                    25% {
                        transform: translate(-30px, 20px) scale(0.9);
                    }
                    50% {
                        transform: translate(20px, 40px) scale(1.3);
                    }
                    75% {
                        transform: translate(10px, -10px) scale(0.7);
                    }
                }

                .lava-card::before {
                    content: '';
                    position: absolute;
                    bottom: -20%;
                    left: 20%;
                    width: 60%;
                    height: 60%;
                    background: radial-gradient(
                        ellipse,
                        rgba(255, 100, 0, 0.6) 0%,
                        rgba(255, 50, 0, 0.3) 50%,
                        transparent 70%
                    );
                    border-radius: 50%;
                    animation: lavaBlob1 12s ease-in-out infinite;
                    filter: blur(20px);
                    z-index: 5;
                }

                .lava-card::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    right: 10%;
                    width: 50%;
                    height: 50%;
                    background: radial-gradient(
                        ellipse,
                        rgba(255, 200, 0, 0.5) 0%,
                        rgba(255, 100, 0, 0.2) 50%,
                        transparent 70%
                    );
                    border-radius: 50%;
                    animation: lavaBlob2 10s ease-in-out infinite;
                    filter: blur(15px);
                    z-index: 5;
                }

                /* ===== GALAXY ===== */
                @keyframes twinkle {
                    0%,
                    100% {
                        opacity: 0.3;
                    }
                    50% {
                        opacity: 1;
                    }
                }

                .galaxy-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(1px 1px at 20% 30%, white, transparent),
                        radial-gradient(1px 1px at 40% 70%, white, transparent),
                        radial-gradient(1px 1px at 50% 20%, white, transparent),
                        radial-gradient(1px 1px at 60% 80%, white, transparent),
                        radial-gradient(1px 1px at 70% 40%, white, transparent),
                        radial-gradient(1px 1px at 80% 60%, white, transparent),
                        radial-gradient(1px 1px at 90% 10%, white, transparent),
                        radial-gradient(1px 1px at 10% 90%, white, transparent),
                        radial-gradient(2px 2px at 30% 50%, rgba(255, 255, 255, 0.8), transparent),
                        radial-gradient(2px 2px at 85% 25%, rgba(255, 255, 255, 0.8), transparent);
                    animation: twinkle 3s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 5;
                }

                .galaxy-card::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 150%;
                    height: 40%;
                    background: radial-gradient(ellipse, rgba(138, 43, 226, 0.2) 0%, transparent 70%);
                    transform: translate(-50%, -50%) rotate(-15deg);
                    pointer-events: none;
                    z-index: 4;
                }

                /* ===== GLITCH ===== */
                @keyframes glitchSkew {
                    0%,
                    100% {
                        transform: skew(0deg);
                    }
                    20% {
                        transform: skew(-2deg);
                    }
                    40% {
                        transform: skew(2deg);
                    }
                    60% {
                        transform: skew(-1deg);
                    }
                    80% {
                        transform: skew(1deg);
                    }
                }

                @keyframes glitchText {
                    0%,
                    100% {
                        text-shadow:
                            -2px 0 #ff0000,
                            2px 0 #00ffff;
                        transform: translate(0);
                    }
                    25% {
                        text-shadow:
                            2px 0 #ff0000,
                            -2px 0 #00ffff;
                        transform: translate(-2px, 1px);
                    }
                    50% {
                        text-shadow:
                            -2px 0 #ff0000,
                            2px 0 #00ffff;
                        transform: translate(2px, -1px);
                    }
                    75% {
                        text-shadow:
                            2px 0 #ff0000,
                            -2px 0 #00ffff;
                        transform: translate(-1px, 2px);
                    }
                }

                .glitch-card {
                    animation: glitchSkew 5s ease-in-out infinite;
                }

                .glitch-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0, 255, 0, 0.03) 2px,
                        rgba(0, 255, 0, 0.03) 4px
                    );
                    pointer-events: none;
                    z-index: 15;
                }

                .glitch-text {
                    animation: glitchText 3s ease-in-out infinite;
                }

                /* ===== HAND DRAWN ===== */
                .handdrawn-card {
                    border-radius: 8px 12px 10px 14px !important;
                    box-shadow: 3px 3px 0 #000;
                }

                .handdrawn-card::before {
                    content: '';
                    position: absolute;
                    inset: 4px;
                    border: 2px dashed rgba(0, 0, 0, 0.1);
                    border-radius: 6px 10px 8px 12px;
                    pointer-events: none;
                    z-index: 5;
                }

                /* ===== TERMINAL ===== */
                @keyframes terminalFlicker {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    92% {
                        opacity: 1;
                    }
                    93% {
                        opacity: 0.8;
                    }
                    94% {
                        opacity: 1;
                    }
                    97% {
                        opacity: 0.9;
                    }
                }

                .terminal-card {
                    animation: terminalFlicker 5s ease-in-out infinite;
                    box-shadow:
                        0 0 10px rgba(0, 255, 0, 0.2),
                        inset 0 0 30px rgba(0, 255, 0, 0.05);
                }

                .terminal-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0, 255, 0, 0.02) 2px,
                        rgba(0, 255, 0, 0.02) 4px
                    );
                    pointer-events: none;
                    z-index: 15;
                }

                /* ===== MINECRAFT ===== */
                .minecraft-card {
                    image-rendering: pixelated;
                    box-shadow:
                        inset -4px -4px 0 0 #555555,
                        inset 4px 4px 0 0 #c6c6c6,
                        6px 6px 0 0 rgba(0, 0, 0, 0.4);
                    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJElEQVQYV2NkYGD4z4AKGFEJ+P/+z8AAEmBiQFKAJgLWgE4AAJo3C/ldh2lVAAAAAElFTkSuQmCC');
                    background-repeat: repeat;
                }

                .minecraft-slot {
                    background: #8b8b8b;
                    border: 2px solid;
                    border-color: #373737 #ffffff #ffffff #373737;
                    box-shadow: inset 2px 2px 0 #555555;
                }

                .minecraft-tooltip {
                    background: linear-gradient(180deg, #100010 0%, #250025 100%);
                    border: 2px solid #250025;
                    padding: 8px;
                    box-shadow: inset 0 0 0 1px #5000ff;
                }

                /* ===== GTA ===== */
                .gta-card {
                    box-shadow:
                        0 0 30px rgba(46, 204, 113, 0.2),
                        inset 0 0 50px rgba(0, 0, 0, 0.5);
                }

                .gta-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, transparent 0%, rgba(46, 204, 113, 0.05) 50%, transparent 100%);
                    pointer-events: none;
                    z-index: 5;
                }

                /* ===== ZELDA ===== */
                @keyframes zeldaShine {
                    0%,
                    100% {
                        opacity: 0.3;
                    }
                    50% {
                        opacity: 0.6;
                    }
                }

                .zelda-card {
                    box-shadow:
                        inset 0 0 30px rgba(200, 168, 50, 0.2),
                        0 0 20px rgba(200, 168, 50, 0.3);
                }

                .zelda-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(ellipse at center, rgba(200, 168, 50, 0.2) 0%, transparent 70%);
                    animation: zeldaShine 3s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 5;
                }

                .zelda-medallion {
                    background: radial-gradient(circle, #1a472a 0%, #0d2415 100%);
                    border: 4px solid #c8a832;
                    border-radius: 50%;
                    box-shadow:
                        0 0 20px rgba(200, 168, 50, 0.5),
                        inset 0 0 15px rgba(200, 168, 50, 0.3);
                }

                /* ===== CYBERPUNK ===== */
                .cyberpunk-card {
                    box-shadow:
                        0 0 10px rgba(0, 240, 255, 0.3),
                        0 0 20px rgba(255, 0, 60, 0.2),
                        inset 0 0 30px rgba(0, 0, 0, 0.8);
                }

                .cyberpunk-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0, 240, 255, 0.02) 2px,
                        rgba(0, 240, 255, 0.02) 4px
                    );
                    pointer-events: none;
                    z-index: 15;
                }

                /* ===== POKEMON ===== */
                .pokemon-card {
                    box-shadow:
                        0 4px 15px rgba(248, 208, 48, 0.4),
                        inset 0 0 20px rgba(248, 208, 48, 0.1);
                }

                .pokemon-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 50%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                    animation: pokemonShine 3s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 15;
                }

                .pokemon-frame {
                    background: linear-gradient(180deg, #fff8dc 0%, #f5deb3 100%);
                    border: 4px solid #f8d030;
                    border-radius: 8px;
                }

                @keyframes pokemonShine {
                    0% {
                        left: -100%;
                    }
                    50%,
                    100% {
                        left: 150%;
                    }
                }

                /* ===== PLASMA SHADER ===== */
                @keyframes plasmaShift {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }

                @keyframes plasmaWave {
                    0% {
                        transform: translateX(-100%) skewX(-15deg);
                    }
                    100% {
                        transform: translateX(200%) skewX(-15deg);
                    }
                }

                .plasma-card {
                    background: linear-gradient(45deg, #12c2e9, #c471ed, #f64f59, #12c2e9, #c471ed, #f64f59);
                    background-size: 400% 400%;
                    animation: plasmaShift 8s ease infinite;
                }

                .plasma-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
                    animation: plasmaWave 4s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 10;
                }

                .plasma-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(
                        circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(255, 255, 255, 0.3) 0%,
                        transparent 50%
                    );
                    pointer-events: none;
                    z-index: 11;
                }

                /* ===== CRT ===== */
                @keyframes crtFlicker {
                    0% {
                        opacity: 0.97;
                    }
                    5% {
                        opacity: 1;
                    }
                    10% {
                        opacity: 0.98;
                    }
                    15% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.99;
                    }
                    80% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 0.96;
                    }
                    100% {
                        opacity: 1;
                    }
                }

                @keyframes crtScanline {
                    0% {
                        transform: translateY(-100%);
                    }
                    100% {
                        transform: translateY(1000%);
                    }
                }

                .crt-card {
                    animation: crtFlicker 0.15s infinite;
                    box-shadow:
                        0 0 40px rgba(51, 255, 51, 0.15),
                        inset 0 0 100px rgba(51, 255, 51, 0.05);
                    border-radius: 20px !important;
                }

                .crt-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        rgba(0, 0, 0, 0.2),
                        rgba(0, 0, 0, 0.2) 1px,
                        transparent 1px,
                        transparent 2px
                    );
                    pointer-events: none;
                    z-index: 15;
                }

                .crt-card::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 10%;
                    background: linear-gradient(180deg, rgba(51, 255, 51, 0.1) 0%, transparent 100%);
                    animation: crtScanline 8s linear infinite;
                    pointer-events: none;
                    z-index: 16;
                }

                /* ===== FIRE SHADER ===== */
                @keyframes fireFlicker {
                    0%,
                    100% {
                        filter: brightness(1);
                    }
                    50% {
                        filter: brightness(1.2);
                    }
                }

                @keyframes fireWave {
                    0% {
                        background-position: 0% 100%;
                    }
                    100% {
                        background-position: 0% 0%;
                    }
                }

                .fire-card {
                    animation: fireFlicker 0.5s ease-in-out infinite;
                }

                .fire-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(0deg, rgba(255, 100, 0, 0.4) 0%, transparent 50%),
                        linear-gradient(0deg, rgba(255, 200, 0, 0.2) 0%, transparent 30%);
                    animation: fireWave 2s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 5;
                }

                .fire-card::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 40%;
                    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='fire'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.03' numOctaves='3' result='noise'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='noise' scale='20'/%3E%3C/filter%3E%3C/defs%3E%3C/svg%3E");
                    opacity: 0.6;
                    pointer-events: none;
                    z-index: 6;
                }

                .fire-logo {
                    background: radial-gradient(circle, rgba(255, 150, 0, 0.5) 0%, transparent 70%);
                    animation: fireFlicker 0.3s ease-in-out infinite;
                }

                .fire-text {
                    background: linear-gradient(180deg, #ffd700 0%, #ff8c00 30%, #ff4500 60%, #8b0000 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    filter: drop-shadow(0 0 10px rgba(255, 100, 0, 0.8));
                }

                /* ===== UNDERWATER SHADER ===== */
                @keyframes underwaterWave {
                    0%,
                    100% {
                        transform: translateX(0) scaleY(1);
                    }
                    25% {
                        transform: translateX(-5px) scaleY(1.02);
                    }
                    50% {
                        transform: translateX(0) scaleY(1);
                    }
                    75% {
                        transform: translateX(5px) scaleY(0.98);
                    }
                }

                @keyframes bubbleRise {
                    0% {
                        transform: translateY(100%) scale(0.5);
                        opacity: 0;
                    }
                    50% {
                        opacity: 0.8;
                    }
                    100% {
                        transform: translateY(-100%) scale(1);
                        opacity: 0;
                    }
                }

                @keyframes caustics {
                    0% {
                        background-position: 0% 0%;
                    }
                    100% {
                        background-position: 100% 100%;
                    }
                }

                .underwater-card {
                    animation: underwaterWave 4s ease-in-out infinite;
                }

                .underwater-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse at 20% 20%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
                        radial-gradient(ellipse at 80% 80%, rgba(0, 200, 255, 0.1) 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, rgba(0, 150, 255, 0.05) 0%, transparent 70%);
                    animation: caustics 8s linear infinite;
                    pointer-events: none;
                    z-index: 5;
                }

                .underwater-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        180deg,
                        rgba(0, 50, 100, 0.3) 0%,
                        transparent 30%,
                        transparent 70%,
                        rgba(0, 30, 60, 0.4) 100%
                    );
                    pointer-events: none;
                    z-index: 6;
                }

                /* ===== MATRIX SHADER ===== */
                @keyframes matrixRain {
                    0% {
                        background-position: 0% 0%;
                    }
                    100% {
                        background-position: 0% 1000%;
                    }
                }

                .matrix-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ctext x='0' y='15' fill='%2300ff00' fill-opacity='0.1' font-family='monospace' font-size='12'%3E0%3C/text%3E%3C/svg%3E");
                    animation: matrixRain 20s linear infinite;
                    opacity: 0.5;
                    pointer-events: none;
                    z-index: 5;
                }

                .matrix-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 5, 0, 0.8) 100%);
                    pointer-events: none;
                    z-index: 6;
                }

                /* ===== DISCO SHADER ===== */
                @keyframes discoColors {
                    0% {
                        filter: hue-rotate(0deg);
                    }
                    100% {
                        filter: hue-rotate(360deg);
                    }
                }

                @keyframes discoPulse {
                    0%,
                    100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                }

                @keyframes spotlightMove {
                    0% {
                        background-position: 0% 0%;
                    }
                    25% {
                        background-position: 100% 0%;
                    }
                    50% {
                        background-position: 100% 100%;
                    }
                    75% {
                        background-position: 0% 100%;
                    }
                    100% {
                        background-position: 0% 0%;
                    }
                }

                .disco-card {
                    animation: discoPulse 1s ease-in-out infinite;
                }

                .disco-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at 20% 20%, rgba(255, 0, 128, 0.3) 0%, transparent 30%),
                        radial-gradient(circle at 80% 20%, rgba(0, 255, 255, 0.3) 0%, transparent 30%),
                        radial-gradient(circle at 50% 80%, rgba(255, 255, 0, 0.3) 0%, transparent 30%),
                        radial-gradient(circle at 20% 60%, rgba(0, 255, 0, 0.3) 0%, transparent 30%),
                        radial-gradient(circle at 80% 60%, rgba(255, 0, 255, 0.3) 0%, transparent 30%);
                    animation:
                        spotlightMove 4s ease-in-out infinite,
                        discoColors 6s linear infinite;
                    pointer-events: none;
                    z-index: 5;
                }

                .disco-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-conic-gradient(
                        from 0deg,
                        transparent 0deg 10deg,
                        rgba(255, 255, 255, 0.03) 10deg 20deg
                    );
                    animation: discoColors 10s linear infinite reverse;
                    pointer-events: none;
                    z-index: 6;
                }

                .disco-ball {
                    background: linear-gradient(135deg, #c0c0c0 0%, #808080 50%, #c0c0c0 100%);
                    box-shadow:
                        inset -5px -5px 10px rgba(0, 0, 0, 0.3),
                        inset 5px 5px 10px rgba(255, 255, 255, 0.5),
                        0 0 20px rgba(255, 255, 255, 0.5);
                    animation: discoColors 3s linear infinite;
                }

                .disco-text {
                    background: linear-gradient(
                        90deg,
                        #ff0080,
                        #ff8c00,
                        #ffff00,
                        #00ff00,
                        #00ffff,
                        #0080ff,
                        #8000ff,
                        #ff0080
                    );
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    animation: plasmaShift 2s linear infinite;
                }

                /* ===== COMMON ===== */
                .card-transition {
                    transition:
                        opacity 150ms ease-out,
                        transform 150ms ease-out;
                }
            `}</style>
            <div
                className={`flex justify-center ${className || ''}`}
                style={{ perspective: 1000 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                <motion.div
                    ref={cardRef}
                    className={getCardClasses()}
                    style={getCardStyles()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {renderCardContent()}
                </motion.div>
            </div>
        </>
    )
}

export default PioneerCard3D
