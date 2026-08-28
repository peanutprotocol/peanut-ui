import { type HTMLAttributes } from 'react'
import { twMerge } from '@/utils/tw'

// code-only exception: composition recipe with no figma board. owns the
// "section title above a list/card stack" shape so the heading token stops
// being respelled per page (font-bold vs text-heading-card drift).

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    title?: React.ReactNode
}

const Section = ({ title, className, children, ...props }: SectionProps) => (
    <section className={twMerge('flex flex-col gap-2', className)} {...props}>
        {title && <h2 className="text-heading-card text-foreground-primary">{title}</h2>}
        {children}
    </section>
)

export { Section }
