import { Star } from '@/assets'
import { AnimateOnView } from '@/components/Global/AnimateOnView'

interface StarConfig {
    className: string
    width: number
    height: number
    delay: string
    x: string
    rotate: string
}

const defaultStars: StarConfig[] = [
    { className: 'absolute right-6 top-6 md:right-12 md:top-10', width: 40, height: 40, delay: '0.2s', x: '5px', rotate: '22deg' },
    { className: 'absolute left-8 bottom-8 md:left-16', width: 35, height: 35, delay: '0.5s', x: '-5px', rotate: '-15deg' },
    { className: 'absolute right-1/4 bottom-12 hidden md:block', width: 30, height: 30, delay: '0.8s', x: '3px', rotate: '45deg' },
]

/** Decorative animated stars. Sprinkle on sections for visual interest. */
export function Stars({ configs = defaultStars }: { configs?: StarConfig[] }) {
    return (
        <>
            {configs.map((config, i) => (
                <AnimateOnView
                    key={i}
                    className={config.className}
                    delay={config.delay}
                    x={config.x}
                    rotate={config.rotate}
                >
                    <img src={Star.src} alt="" width={config.width} height={config.height} />
                </AnimateOnView>
            ))}
        </>
    )
}
