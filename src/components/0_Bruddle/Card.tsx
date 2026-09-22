import { twMerge } from '@/utils/tw'

export type CardShadowSize = '4' | '6' | '8'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    shadowSize?: CardShadowSize
}

/** Shared surface for Card and native button tiles (board 17802:61536). */
export const CARD_SURFACE = 'rounded-sm border border-border-default bg-background-default'

const shadowClasses: Record<CardShadowSize, string> = {
    '4': 'shadow-4',
    '6': 'shadow-primary-6',
    '8': 'shadow-primary-8',
}

const Card = ({ children, className, shadowSize, ...props }: CardProps) => {
    const shadowClass = shadowSize ? shadowClasses[shadowSize] : ''

    return (
        <div
            // Tailwind merge makes sure classes added through className by component caller are merged and overrides the default classes
            className={twMerge(`flex flex-col ${CARD_SURFACE}`, shadowClass, className)}
            {...props}
        >
            {children}
        </div>
    )
}

const Header = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('card-head', className)} {...props}>
        {children}
    </div>
)

const Title = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={twMerge('pb-1 text-start text-heading-card', className)} {...props}>
        {children}
    </h3>
)

const Description = ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={twMerge('text-start text-body-m text-foreground-secondary', className)} {...props}>
        {children}
    </p>
)

const Content = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('card-content', className)} {...props}>
        {children}
    </div>
)

Card.Header = Header
Card.Title = Title
Card.Description = Description
Card.Content = Content

export { Card }
