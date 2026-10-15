'use client'

import type { ReactNode } from 'react'
import ActionModal, {
    type ActionModalButtonProps,
    type ActionModalCheckboxProps,
    type ActionModalProps,
    type ActionModalTertiaryCta,
} from '@/components/Global/ActionModal'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/Global/Drawer'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { Button } from '@/components/0_Bruddle/Button'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'
import type { InterruptPresentation } from './types'

export interface AskShellProps {
    presentation: InterruptPresentation
    visible?: boolean
    icon?: IconName
    concept?: Concept
    iconColor?: IconBubbleColor
    tone?: ActionModalProps['tone']
    title: ReactNode
    description?: ReactNode
    body?: ReactNode
    checkbox?: ActionModalCheckboxProps
    ctas?: ActionModalButtonProps[]
    tertiaryCta?: ActionModalTertiaryCta
    dismissible?: boolean
    onClose: () => void
    ctaClassName?: string
    testId?: string
    preventClose?: boolean
    hideModalCloseButton?: boolean
}

const TONES = {
    error: { icon: 'ban', color: 'red' },
    attention: { icon: 'alert', color: 'yellow' },
    success: { icon: 'check', color: 'green' },
    info: { icon: 'info', color: 'blue' },
    peanut: { icon: undefined, color: 'yellow' },
} as const

export function AskShell({
    presentation,
    visible = true,
    dismissible = true,
    body,
    iconColor,
    testId,
    ...props
}: AskShellProps) {
    if (presentation === 'modal') {
        const modalProps = {
            ...props,
            visible,
            content: body,
            ...(iconColor && { iconColor }),
            ...(!dismissible && { preventClose: true, hideModalCloseButton: true }),
            ...(testId && { 'data-testid': testId }),
        } as ActionModalProps
        return <ActionModal {...modalProps} />
    }
    const bubble = props.concept ? CONCEPT_ICONS[props.concept] : props.tone ? TONES[props.tone] : undefined
    const icon = props.icon ?? bubble?.icon
    const color = iconColor ?? bubble?.color
    return (
        <Drawer
            open={visible}
            dismissible={dismissible}
            onOpenChange={(open) => {
                if (!open && dismissible) props.onClose()
            }}
        >
            <DrawerContent data-testid={testId}>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className={twMerge('flex w-full flex-col items-center gap-4', body && 'mb-3')}>
                        {icon && <IconBubble icon={icon} color={color} />}
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{props.title}</DrawerTitle>
                            {props.description && <DrawerDescription>{props.description}</DrawerDescription>}
                        </DrawerHeader>
                    </div>
                    {body && <div className="flex w-full flex-col items-center gap-4">{body}</div>}
                    {(props.checkbox || !!props.ctas?.length) && (
                        <div className="space-y-4 mt-6 w-full">
                            {props.checkbox && (
                                <div className={twMerge('flex justify-center', props.checkbox.className)}>
                                    <Checkbox
                                        label={props.checkbox.text}
                                        value={props.checkbox.checked}
                                        onChange={(event) => props.checkbox?.onChange(event.target.checked)}
                                        className={props.checkbox.inputClassName}
                                    />
                                </div>
                            )}
                            {!!props.ctas?.length && (
                                <div
                                    className={twMerge(
                                        'flex w-full gap-4',
                                        props.ctas.length > 1 ? 'flex-col sm:flex-row' : 'flex-col',
                                        props.ctaClassName
                                    )}
                                >
                                    {props.ctas.map(
                                        (
                                            {
                                                text,
                                                children,
                                                icon: buttonIcon,
                                                iconPosition,
                                                className,
                                                variant = 'primary',
                                                ...rest
                                            },
                                            index
                                        ) => {
                                            const position = buttonIcon && !iconPosition ? 'left' : iconPosition
                                            return (
                                                <Button
                                                    key={index}
                                                    variant={variant}
                                                    iconPosition={position}
                                                    className={twMerge(
                                                        'w-full justify-center',
                                                        props.ctas!.length > 1 && 'sm:flex-1',
                                                        className
                                                    )}
                                                    {...rest}
                                                >
                                                    {children}
                                                    {buttonIcon && position === 'left' && (
                                                        <Icon
                                                            name={buttonIcon as IconName}
                                                            size={16}
                                                            className={twMerge('mr-2', rest.disabled && 'opacity-50')}
                                                        />
                                                    )}
                                                    {text}
                                                    {buttonIcon && position === 'right' && (
                                                        <Icon
                                                            name={buttonIcon as IconName}
                                                            size={16}
                                                            className={twMerge('ml-2', rest.disabled && 'opacity-50')}
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
                    {props.tertiaryCta && (
                        <div className="mt-6 flex w-full justify-center">
                            <LinkButton
                                onClick={props.tertiaryCta.onClick}
                                href={props.tertiaryCta.href}
                                disabled={props.tertiaryCta.disabled}
                                data-testid={props.tertiaryCta['data-testid']}
                            >
                                {props.tertiaryCta.text}
                            </LinkButton>
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default AskShell
