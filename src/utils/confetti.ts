import confetti from 'canvas-confetti'

export interface ConfettiOptions {
    particleCount?: number
    scalar?: number
    origin?: { x: number; y: number }
    colors?: string[]
    startVelocity?: number
    gravity?: number
    spread?: number
    ticks?: number
    decay?: number
}

const defaultConfettiConfig = {
    spread: 360,
    ticks: 80,
    gravity: 0.3,
    decay: 0.96,
    startVelocity: 15,
    colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
}

export const shootStarConfetti = (options: ConfettiOptions = {}) => {
    // Ensure we're on the client side
    if (typeof window === 'undefined') return

    const {
        particleCount = 100,
        scalar = 1.8,
        origin = { x: 0.5, y: 0.6 },
        colors = defaultConfettiConfig.colors,
        ...otherOptions
    } = options

    const config = {
        ...defaultConfettiConfig,
        ...otherOptions,
        colors,
        particleCount,
        scalar,
        shapes: ['star' as confetti.Shape],
        origin,
    }

    confetti(config)
}

export const shootDoubleStarConfetti = (options: ConfettiOptions = {}) => {
    const { origin = { x: 0.5, y: 0.6 } } = options

    // First burst - larger stars
    shootStarConfetti({
        ...options,
        particleCount: 100,
        scalar: 1.8,
        origin,
    })

    // Second burst - smaller stars
    shootStarConfetti({
        ...options,
        particleCount: 100,
        scalar: 1.4,
        origin,
    })
}

// Preset configurations for common use cases
export const confettiPresets = {
    success: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.6 } }),
    celebration: () =>
        shootDoubleStarConfetti({
            origin: { x: 0.5, y: 0.3 },
            particleCount: 150,
            spread: 180,
        }),
    gentle: () =>
        shootStarConfetti({
            particleCount: 50,
            scalar: 1.5,
            startVelocity: 10,
        }),
}
