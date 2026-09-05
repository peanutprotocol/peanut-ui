import { Button, type ButtonProps } from '@/components/0_Bruddle/Button'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
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

export type ActionModalTone = 'error' | 'warning' | 'success' | 'info'

// mirrors PRIORITY_STYLES in 0_Bruddle/Notification: yellow is for warnings
// only, red for errors, green for success, blue for plain information
const TONE_STYLES: Record<ActionModalTone, { icon: IconName; color: IconBubbleColor }> = {
    error: { icon: 'ban', color: 'red' },
    warning: { icon: 'alert', color: 'yellow' },
    success: { icon: 'check', color: 'green' },
    info: { icon: 'info', color: 'blue' },
}

export interface ActionModalProps {
    visible: boolean
    onClose: () => void
    title: string | React.ReactNode
    description?: string | React.ReactNode
    /** Semantic bubble color + default icon. Explicit `icon` / `iconContainerClassName` still win. */
    tone?: ActionModalTone
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
    /** The footer is decoration (an absolutely positioned mascot), not an
     *  action. It renders outside the in-flow wrapper, so it adds no row of
     *  its own beneath the ctas. */
    footerIsDecorative?: boolean
    content?: React.ReactNode
    classOverlay?: string
    hideOverlay?: boolean
}

const ActionModal: React.FC<ActionModalProps> = ({
    visible,
    onClose,
    title,
    description,
    tone,
    icon: customIcon,
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
    footerIsDecorative = false,
    content,
    classOverlay,
    hideOverlay,
}) => {
    const defaultModalPanelClasses = 'max-w-[85%]'
    const defaultIconContainerClassName = 'bg-action-primary' // default pink background
    const defaultIconPropsClassName = 'text-black' // default black icon color
    const toneStyle = tone ? TONE_STYLES[tone] : undefined
    const icon = customIcon ?? toneStyle?.icon

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
            {/* anatomy 17800:57224: p = XL/24, the icon and the head sit L/16
                apart inside a "Top" group, and the head's own title and
                description XS/4 apart.
                The M/12 under the head is the gap to the BODY, so it only
                applies when there is one. The ctas own their XL/24 outright, so
                a modal with no body keeps the board's 24px between its head and
                its buttons instead of pulling them up under the copy.
                Margins, not a parent gap: a gap collapses when the body is
                absent, which silently left half these screens unchanged. */}
            <div className={twMerge('flex flex-col items-center p-6 text-center', contentContainerClassName)}>
                <div
                    className={twMerge('flex w-full flex-col items-center gap-4', content && 'mb-3')}
                    data-testid="modal-head"
                >
                    {iconContent && (
                        <IconBubble
                            size="m"
                            icon={iconContent}
                            color={toneStyle?.color}
                            // custom classes AUGMENT the default (or the tone), never
                            // bare-|| replace it — the IconBubble board forbids
                            // resizing the bubble, and the ! overrides existed only
                            // because of the old replace
                            className={twMerge(
                                toneStyle ? undefined : defaultIconContainerClassName,
                                customIconContainerClassName
                            )}
                            data-testid="action-modal-icon"
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

                {content && <div className="w-full">{content}</div>}

                {(checkbox || (ctas && ctas.length > 0)) && (
                    <div className="space-y-4 mt-6 w-full">
                        {checkbox && (
                            <div className={twMerge('flex justify-center', checkbox.className)}>
                                <Checkbox
                                    label={checkbox.text}
                                    value={checkbox.checked}
                                    onChange={(e) => checkbox.onChange(e.target.checked)}
                                    className={checkbox.inputClassName}
                                />
                            </div>
                        )}

                        {ctas && ctas.length > 0 && (
                            <div
                                className={twMerge(
                                    'flex w-full gap-4',
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
                {/* An action footer is a row and gets the XL/24 above it. A
                    decorative one is absolutely positioned, so wrapping it would
                    leave an empty 24px row under the ctas and grow the panel. */}
                {footer && (footerIsDecorative ? footer : <div className="mt-6 w-full">{footer}</div>)}
            </div>
        </BaseModal>
    )
}

export default ActionModal
