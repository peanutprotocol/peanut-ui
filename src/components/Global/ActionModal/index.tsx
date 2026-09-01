import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { type IconProps as GlobalIconProps, Icon, type IconName } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import BaseModal from '@/components/Global/Modal'
import React from 'react'
import { twMerge } from '@/utils/tw'

export interface ActionModalButtonProps extends ButtonProps {
    text: string
    iconPosition?: 'left' | 'right'
    children?: React.ReactNode
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
    icon?: IconName | React.ReactElement
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
    content?: React.ReactNode
    classOverlay?: string
    hideOverlay?: boolean
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
    content,
    classOverlay,
    hideOverlay,
}) => {
    const defaultModalPanelClasses = 'max-w-[85%]'
    const defaultIconContainerClassName = 'bg-action-primary' // default pink background
    const defaultIconPropsClassName = 'text-black' // default black icon color

    // board bubble is the 48px icon bubble with a 24px icon (17800:57255,
    // 17829:74078) — was a hand-rolled 32px circle with a 16px icon
    const renderIconContent = () => {
        if (isLoadingIcon) {
            return <Loading className={twMerge('size-6', defaultIconPropsClassName, iconProps?.className)} />
        }
        if (typeof icon === 'string') {
            return (
                <Icon
                    name={icon as IconName}
                    fill="currentColor"
                    size={24}
                    {...iconProps}
                    className={twMerge(defaultIconPropsClassName, iconProps?.className)}
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
                // board 17800:57216 panel: white, border-default, 4px corners
                // (17800:57252 + 17829:74075 both use --xs,4px — one step softer
                // than card/list; the earlier "2px" comment misread the board)
                'sm:m-auto sm:self-center self-center m-4 bg-background-default rounded border border-border-default z-50',
                defaultModalPanelClasses,
                modalPanelClassName
            )}
            classOverlay={classOverlay}
            hideOverlay={hideOverlay}
        >
            {/* anatomy 17800:57224: p = XL/24, and the stack is nested — the icon
                and the head sit L/16 apart inside a "Top" group, the head's own
                title and description XS/4 apart, and the whole group is XL/24
                from the ctas. It used to be one flat gap-4, so the description
                sat as far from its title as the ctas did from the head. */}
            <div className={twMerge('flex flex-col items-center gap-6 p-6 text-center', contentContainerClassName)}>
                <div className="flex w-full flex-col items-center gap-4">
                    {iconContent && (
                        <IconBubble
                            size="m"
                            icon={iconContent}
                            className={customIconContainerClassName || defaultIconContainerClassName}
                        />
                    )}

                    <div className="flex w-full flex-col gap-1">
                        {/* board head: Heading XS + Body S */}
                        <h3 className={twMerge('text-heading-xs text-foreground-primary', titleClassName)}>{title}</h3>
                        {description && (
                            <div className={twMerge('text-body-s text-foreground-secondary', descriptionClassName)}>
                                {typeof description === 'string' ? <p>{description}</p> : description}
                            </div>
                        )}
                    </div>
                </div>

                {content}

                {(checkbox || (ctas && ctas.length > 0)) && (
                    <div className="space-y-4 w-full">
                        {checkbox && (
                            <div className={twMerge('self-start text-left', checkbox.className)}>
                                <label className="space-x-2 flex cursor-pointer items-center justify-center text-body-s dark:text-white">
                                    <input
                                        type="checkbox"
                                        className={twMerge(
                                            'h-4 w-4 rounded text-action-primary shadow-sm focus:border-purple-200 focus:ring focus:ring-action-focus/50 dark:bg-gray-900 dark:ring-offset-black dark:checked:bg-action-primary dark:focus:ring-action-primary/50',
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
                                            children,
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
                                                {children}
                                                {btnIcon && currentIconPosition === 'left' && (
                                                    <Icon
                                                        name={btnIcon as IconName}
                                                        size={16}
                                                        className={twMerge('mr-2', rest.disabled ? 'opacity-50' : '')}
                                                    />
                                                )}
                                                {text}
                                                {btnIcon && currentIconPosition === 'right' && (
                                                    <Icon
                                                        name={btnIcon as IconName}
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
                {footer}
            </div>
        </BaseModal>
    )
}

export default ActionModal
