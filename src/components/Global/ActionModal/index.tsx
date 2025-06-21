import { Button, ButtonProps } from '@/components/0_Bruddle/Button'
import { IconProps as GlobalIconProps, Icon, IconName } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import BaseModal from '@/components/Global/Modal'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface ActionModalButtonProps extends ButtonProps {
    text: string
    iconPosition?: 'left' | 'right'
}

export interface ActionModalCheckboxProps {
    text: string | React.ReactNode
    checked: boolean
    onChange: (checked: boolean) => void
    className?: string
    inputClassName?: string
}

export interface ActionModalProps {
    visible: boolean
    onClose: () => void
    title: string | React.ReactNode
    description?: string | React.ReactNode
    icon?: IconName | React.ReactNode
    iconProps?: Partial<Omit<GlobalIconProps, 'name'>>
    iconContainerClassName?: string
    isLoadingIcon?: boolean
    ctas?: ActionModalButtonProps[]
    ctaClassName?: HTMLDivElement['className']
    checkbox?: ActionModalCheckboxProps
    preventClose?: boolean
    initialFocus?: React.RefObject<HTMLElement>
    modalClassName?: string
    modalPanelClassName?: string
    contentContainerClassName?: string
    hideModalCloseButton?: boolean
    titleClassName?: string
    descriptionClassName?: string
    buttonProps?: ButtonProps
    footer?: React.ReactNode
}

const ActionModal: React.FC<ActionModalProps> = ({
    visible,
    onClose,
    title,
    description,
    icon,
    iconProps,
    iconContainerClassName: customIconContainerClassName,
    isLoadingIcon = false,
    ctas,
    ctaClassName,
    checkbox,
    preventClose,
    initialFocus,
    modalClassName,
    modalPanelClassName,
    contentContainerClassName,
    hideModalCloseButton = false,
    titleClassName,
    descriptionClassName,
    buttonProps,
    footer,
}) => {
    const defaultModalPanelClasses = 'max-w-[85%]'
    const defaultIconContainerClassName = 'bg-primary-1' // default pink background
    const defaultIconPropsClassName = 'text-black' // default black icon color

    const renderIconContent = () => {
        if (isLoadingIcon) {
            return <Loading className={twMerge('size-4', defaultIconPropsClassName, iconProps?.className)} />
        }
        if (typeof icon === 'string') {
            return (
                <Icon
                    name={icon as IconName}
                    fill="currentColor"
                    {...iconProps}
                    className={twMerge('size-4', defaultIconPropsClassName, iconProps?.className)}
                />
            )
        }
        if (React.isValidElement(icon)) {
            // if a custom ReactNode icon is provided, it should handle its own styling
            return icon
        }
        return null
    }

    const iconContent = renderIconContent()

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            preventClose={preventClose}
            initialFocus={initialFocus}
            className={twMerge('items-center justify-center md:mx-auto md:max-w-md', modalClassName)}
            classButtonClose={hideModalCloseButton ? '!hidden' : ''}
            classWrap={twMerge(
                'sm:m-auto sm:self-center self-center m-4 bg-white rounded-none border-0 z-50',
                defaultModalPanelClasses,
                modalPanelClassName
            )}
        >
            <div className={twMerge('flex flex-col items-center gap-4 p-6 text-center', contentContainerClassName)}>
                {iconContent && (
                    <div
                        className={twMerge(
                            'flex size-8 items-center justify-center rounded-full',
                            customIconContainerClassName || defaultIconContainerClassName
                        )}
                    >
                        {iconContent}
                    </div>
                )}

                <div className="w-full space-y-2">
                    <h3 className={twMerge('text-base font-bold text-black dark:text-white', titleClassName)}>
                        {title}
                    </h3>
                    {description && (
                        <div className={twMerge('text-sm text-grey-1 dark:text-white', descriptionClassName)}>
                            {typeof description === 'string' ? <p>{description}</p> : description}
                        </div>
                    )}
                </div>

                {(checkbox || (ctas && ctas.length > 0)) && (
                    <div className="w-full space-y-4">
                        {checkbox && (
                            <div className={twMerge('self-start text-left', checkbox.className)}>
                                <label className="flex cursor-pointer items-center justify-center space-x-2 text-sm dark:text-white">
                                    <input
                                        type="checkbox"
                                        className={twMerge(
                                            'h-4 w-4 rounded border-gray-300 text-primary-1 shadow-sm focus:border-primary-3 focus:ring focus:ring-primary-2 focus:ring-opacity-50 dark:border-gray-600 dark:bg-n-2 dark:ring-offset-n-1 dark:checked:bg-primary-1 dark:focus:ring-primary-1',
                                            checkbox.inputClassName
                                        )}
                                        checked={checkbox.checked}
                                        onChange={(e) => checkbox.onChange(e.target.checked)}
                                    />
                                    <span>{checkbox.text}</span>
                                </label>
                            </div>
                        )}

                        {ctas && ctas.length > 0 && (
                            <div
                                className={twMerge(
                                    'flex w-full gap-3',
                                    ctas.length > 1 ? 'flex-col sm:flex-row' : 'flex-col',
                                    ctaClassName
                                )}
                            >
                                {ctas.map(
                                    (
                                        {
                                            text,
                                            onClick,
                                            variant = 'purple',
                                            className: btnClassName,
                                            icon: btnIcon,
                                            iconPosition,
                                            ...rest
                                        },
                                        index
                                    ) => {
                                        const currentIconPosition = btnIcon && !iconPosition ? 'left' : iconPosition

                                        return (
                                            <Button
                                                key={index}
                                                onClick={onClick}
                                                variant={variant}
                                                iconPosition={currentIconPosition}
                                                {...buttonProps}
                                                className={twMerge(
                                                    'w-full justify-center',
                                                    ctas.length > 1 && 'sm:flex-1',
                                                    btnClassName
                                                )}
                                                {...rest}
                                            >
                                                {btnIcon && currentIconPosition === 'left' && (
                                                    <Icon
                                                        name={btnIcon}
                                                        size={16}
                                                        className={twMerge('mr-2', rest.disabled ? 'opacity-50' : '')}
                                                    />
                                                )}
                                                {text}
                                                {btnIcon && currentIconPosition === 'right' && (
                                                    <Icon
                                                        name={btnIcon}
                                                        size={16}
                                                        className={twMerge('ml-2', rest.disabled ? 'opacity-50' : '')}
                                                    />
                                                )}
                                            </Button>
                                        )
                                    }
                                )}
                            </div>
                        )}
                    </div>
                )}
                {footer && footer}
            </div>
        </BaseModal>
    )
}

export default ActionModal
