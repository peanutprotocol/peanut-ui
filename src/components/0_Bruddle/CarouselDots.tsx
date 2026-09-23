import { twMerge } from '@/utils/tw'

interface CarouselDotsProps {
    count: number
    activeIndex: number
    variant?: 'default' | 'white'
    /** Makes each dot clickable. */
    onSelect?: (index: number) => void
    className?: string
    'aria-label'?: string
}

/**
 * Carousel stepper dots from the carousel board (17788:51112): active step is
 * a 24x8 pill in border/default, inactive steps are 8px dots in border/subtle.
 * The white variant stays legible over coloured surfaces.
 */
export const CarouselDots = ({
    count,
    activeIndex,
    variant = 'default',
    onSelect,
    className,
    ...props
}: CarouselDotsProps) => (
    <div
        className={twMerge('flex items-center gap-2', className)}
        role={props['aria-label'] ? 'group' : undefined}
        {...props}
    >
        {Array.from({ length: count }, (_, i) => {
            const dotClass =
                i === activeIndex
                    ? twMerge('h-2 w-6 rounded-full bg-border-default', variant === 'white' && 'bg-white')
                    : twMerge('size-2 rounded-full bg-border-subtle', variant === 'white' && 'bg-white/60')
            return onSelect ? (
                // 8px dots sit 8px apart, so a full 44px hit area would overlap
                // its neighbours — the pseudo-element extends to ~32px tall and
                // half the gap sideways instead (the LinkButton/Toggle pattern)
                <button
                    key={i}
                    type="button"
                    onClick={() => onSelect(i)}
                    className={twMerge(
                        dotClass,
                        'relative transition-all duration-fast after:absolute after:-inset-x-1 after:-inset-y-3'
                    )}
                    aria-label={`${i + 1} / ${count}`}
                    aria-current={i === activeIndex}
                />
            ) : (
                <span key={i} className={twMerge(dotClass, 'transition-all duration-fast')} />
            )
        })}
    </div>
)
