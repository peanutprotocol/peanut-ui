import classNames from 'classnames'

type ShadowSize = '4' | '6' | '8'
type ShadowColor = 'primary' | 'secondary'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    shadowSize?: ShadowSize
    color?: ShadowColor
}

const shadowClasses: Record<ShadowColor, Record<ShadowSize, string>> = {
    primary: {
        '4': 'shadow-primary-4',
        '6': 'shadow-primary-6',
        '8': 'shadow-primary-8',
    },
    secondary: {
        '4': 'shadow-secondary-4',
        '6': 'shadow-secondary-6',
        '8': 'shadow-secondary-8',
    },
}

export const Card = ({ children, className, shadowSize = '4', color = 'primary', ...props }: CardProps) => {
    const shadowClass = shadowClasses[color][shadowSize]

    return (
        <div
            className={classNames(`flex border border-n-1 p-4 dark:border-white dark:bg-n-1`, shadowClass, className)}
            {...props}
        >
            {children}
        </div>
    )
}
