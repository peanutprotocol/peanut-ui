import React from 'react'
import { useTranslations } from 'next-intl'
import Card from '../Card'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconProps } from '../Icons/Icon'

interface InfoCardProps {
    variant?: 'warning' | 'error' | 'info' | 'success' | 'default'
    className?: string
    icon?: IconProps['name']
    iconSize?: number
    iconClassName?: string
    title?: string
    titleClassName?: string
    description?: string | React.ReactNode
    descriptionClassName?: string
    items?: Array<string | React.ReactNode>
    itemsType?: 'disc' | 'decimal'
    itemIcon?: IconProps['name']
    itemIconSize?: number
    itemIconClassName?: string
    containerClassName?: string
    customContent?: React.ReactNode
}

// ds-06: variants use the notification-priority token colors (board 17802:61535
// priorities / badge tokens): warning=attention, info=info, error=error,
// success=success, default=helper. borderless tinted fill, dark text.
const VARIANT_CLASSES = {
    warning: 'border-transparent bg-background-badge-attention text-foreground-primary',
    error: 'border-transparent bg-background-badge-error text-foreground-primary',
    info: 'border-transparent bg-background-badge-info text-foreground-primary',
    default: 'border-transparent bg-background-badge-helper text-foreground-primary',
    success: 'border-transparent bg-background-badge-success text-foreground-primary',
} as const

const BASE_TEXT_CLASSES = 'text-start text-xs md:text-sm'

const InfoCard = ({
    variant = 'default',
    className,
    icon,
    iconSize = 14,
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
    containerClassName,
    customContent,
}: InfoCardProps) => {
    const t = useTranslations('global')
    const variantClasses = VARIANT_CLASSES[variant]
    const hasContent = title || description || items || customContent

    return (
        <Card className={twMerge('flex w-full border', variantClasses, className)}>
            <div className={twMerge('flex w-full gap-2', icon ? 'items-start' : 'items-center', containerClassName)}>
                {icon && (
                    <Icon
                        name={icon}
                        width={iconSize}
                        height={iconSize}
                        className={twMerge('mt-0.5 flex-shrink-0', iconClassName)}
                    />
                )}
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
                                        'space-y-1 mr-auto text-left',
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
                    {!hasContent && <span className={BASE_TEXT_CLASSES}>{t('infoCard.noContent')}</span>}

                    {customContent && customContent}
                </div>
            </div>
        </Card>
    )
}

export default InfoCard
