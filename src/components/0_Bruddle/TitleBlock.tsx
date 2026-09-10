import { type HTMLAttributes } from 'react'
import { twMerge } from '@/utils/tw'

// code-only exception: composition recipe with no figma board. the
// title + supporting-text pair extracted from EmptyState so hero/intro
// blocks share one anatomy. type tokens only.

type TitleBlockSize = 'card' | 's' | 'm'

interface TitleBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode
    description?: React.ReactNode
    align?: 'start' | 'center'
    size?: TitleBlockSize
}

const titleToken: Record<TitleBlockSize, string> = {
    card: 'text-heading-card',
    s: 'text-heading-s',
    m: 'text-heading-m',
}

const TitleBlock = ({
    title,
    description,
    align = 'start',
    size = 'card',
    className,
    children,
    ...props
}: TitleBlockProps) => (
    <div className={twMerge('flex flex-col gap-1', align === 'center' && 'text-center', className)} {...props}>
        <div className={twMerge(titleToken[size], 'text-foreground-primary')}>{title}</div>
        {description && <div className="text-body-s text-foreground-secondary">{description}</div>}
        {children}
    </div>
)

export { TitleBlock }
