import classNames from 'classnames'

type ShadowSize = '4' | '6' | '8'
type ShadowColor = 'primary' | 'secondary'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    shadowSize?: ShadowSize
    color?: ShadowColor
}

export const Card = ({ children, className, shadowSize = '4', color = 'primary', ...props }: CardProps) => {
    const shadowClass = `shadow-${color}-${shadowSize}`

    return (
        <div
            className={classNames(
                `flex border border-n-1 bg-white p-4 dark:border-white dark:bg-n-1`,
                shadowClass,
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}

