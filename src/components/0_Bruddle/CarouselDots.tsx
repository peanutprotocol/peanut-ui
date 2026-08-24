import { twMerge } from '@/utils/tw'

interface CarouselDotsProps {
    count: number
    activeIndex: number
    /** Makes each dot clickable. */
    onSelect?: (index: number) => void
    className?: string
    'aria-label'?: string
}

/**
 * Carousel stepper dots from the carousel board (17788:51112): active step is
 * a 24x8 pill in border/default, inactive steps are 8px dots in border/subtle.
 */
export const CarouselDots = ({ count, activeIndex, onSelect, className, ...props }: CarouselDotsProps) => (
    <div className={twMerge('flex items-center gap-2', className)} {...props}>
        {Array.from({ length: count }, (_, i) => {
            const dotClass =
                i === activeIndex ? 'h-2 w-6 rounded-round bg-border-default' : 'size-2 rounded-round bg-border-subtle'
            return onSelect ? (
                <button
                    key={i}
                    type="button"
                    onClick={() => onSelect(i)}
                    className={twMerge(dotClass, 'transition-all duration-fast')}
                    aria-label={`${i + 1} / ${count}`}
                    aria-current={i === activeIndex}
                />
            ) : (
                <span key={i} className={twMerge(dotClass, 'transition-all duration-fast')} />
            )
        })}
    </div>
)
