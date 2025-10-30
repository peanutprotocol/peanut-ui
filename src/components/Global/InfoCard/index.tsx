import React from 'react'
import Card from '../Card'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconProps } from '../Icons/Icon'

interface InfoCardProps {
    variant?: 'warning' | 'error' | 'info' | 'default'
    className?: string
    icon?: IconProps['name']
    iconSize?: number
    iconClassName?: string
    title?: string
    titleClassName?: string
    description?: string
    descriptionClassName?: string
    items?: Array<string | React.ReactNode>
    itemsType?: 'disc' | 'decimal'
    itemIcon?: IconProps['name']
    itemIconSize?: number
    itemIconClassName?: string
}

const VARIANT_CLASSES = {
    warning: 'border-yellow-9 bg-yellow-10 text-yellow-11',
    error: 'border-error-5 bg-error-6 text-error',
    info: 'border-secondary-7 bg-secondary-9 text-black',
    default: 'border-grey-1 bg-grey-4 text-black',
} as const

const BASE_TEXT_CLASSES = 'text-start text-xs md:text-sm'

const InfoCard = ({
    variant = 'default',
    className,
    icon,
    iconSize = 16,
    iconClassName,
    title,
    titleClassName,
    description,
    descriptionClassName,
    items,
    itemsType = 'disc',
    itemIcon,
    itemIconSize = 16,
    itemIconClassName,
}: InfoCardProps) => {
    const variantClasses = VARIANT_CLASSES[variant]
    const hasContent = title || description || items

    return (
        <Card className={twMerge('flex w-full border', variantClasses, className)}>
            <div className={twMerge('flex w-full gap-2', icon ? 'items-start' : 'items-center')}>
                {icon && <Icon name={icon} width={iconSize} height={iconSize} className={iconClassName} />}
                <div className="flex flex-1 flex-col gap-1">
                    {title && <span className={twMerge(BASE_TEXT_CLASSES, 'font-bold', titleClassName)}>{title}</span>}
                    {description && (
                        <span className={twMerge(BASE_TEXT_CLASSES, descriptionClassName)}>{description}</span>
                    )}
                    {items && items.length > 0 && (
                        <>
                            {itemIcon ? (
                                <div className="flex flex-col gap-1">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Icon
                                                name={itemIcon}
                                                width={itemIconSize}
                                                height={itemIconSize}
                                                className={itemIconClassName}
                                            />
                                            <span className={BASE_TEXT_CLASSES}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <ol
                                    className={twMerge(
                                        'mr-auto space-y-1 text-left',
                                        BASE_TEXT_CLASSES,
                                        itemsType === 'disc' ? 'list-inside list-disc' : 'list-inside list-decimal'
                                    )}
                                >
                                    {items.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ol>
                            )}
                        </>
                    )}
                    {!hasContent && <span className={BASE_TEXT_CLASSES}>No content provided</span>}
                </div>
            </div>
        </Card>
    )
}

export default InfoCard
