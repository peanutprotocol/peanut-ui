import { twMerge } from '@/utils/tw'

type ShadowSize = '4' | '6' | '8'
type ShadowColor = 'primary' | 'secondary'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    shadowSize?: ShadowSize
    color?: ShadowColor
}

const shadowClasses: Record<ShadowColor, Record<ShadowSize, string>> = {
    primary: {
        '4': 'shadow-4',
        '6': 'shadow-primary-6',
        '8': 'shadow-primary-8',
    },
    secondary: {
        '4': 'shadow-secondary-4',
        '6': 'shadow-secondary-6',
        '8': 'shadow-secondary-8',
    },
}

const Card = ({ children, className, shadowSize, color = 'primary', ...props }: CardProps) => {
    const shadowClass = shadowSize ? shadowClasses[color][shadowSize] : ''

    return (
        <div
            // Tailwind merge makes sure classes added through className by component caller are merged and overrides the default classes
            className={twMerge(
                // board 17802:61536: white bg, (#161616), 2px radius, no shadow by default
                `flex flex-col rounded-sm border border-border-default bg-background-default`,
                shadowClass,
                className
            )}
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
