import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * The one title block of the sign-up steps: a title and a description, 16px apart.
 * Sell screens use the larger heading; a statement description continues the
 * heading after one blank line ("A US-issued Visa Platinum card." / "Oh, and it's pink.").
 */
export default function SetupTitleBlock({
    title,
    description,
    size = 's',
    descriptionInTitle = false,
    className,
    titleClassName,
    descriptionClassName,
}: {
    title?: ReactNode
    description?: ReactNode
    size?: 's' | 'm'
    descriptionInTitle?: boolean
    className?: string
    titleClassName?: string
    descriptionClassName?: string
}) {
    if (!title && !description) return null
    const titleClasses = twMerge(
        'w-full text-left',
        size === 'm' ? 'text-heading-m leading-[2.75rem]' : 'text-heading-s',
        titleClassName
    )
    return (
        <div className={twMerge('mx-auto space-y-4 w-full', className)}>
            {descriptionInTitle ? (
                <h1 className={titleClasses}>
                    {title}
                    {description && <span className="mt-11 block">{description}</span>}
                </h1>
            ) : (
                <>
                    {title && <h1 className={titleClasses}>{title}</h1>}
                    {description && (
                        <p
                            className={twMerge(
                                'text-body-m leading-[1.625rem] text-foreground-secondary',
                                descriptionClassName
                            )}
                        >
                            {description}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
