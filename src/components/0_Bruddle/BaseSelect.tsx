'use client'

import { forwardRef } from 'react'
import {
    Root,
    Trigger,
    Value,
    Icon as SelectIcon,
    Portal,
    Content,
    Viewport,
    Item,
    ItemText,
    ItemIndicator,
} from '@radix-ui/react-select'
import { twMerge } from '@/utils/tw'
import { Icon } from '@/components/Global/Icons/Icon'

export interface BaseSelectOption {
    label: string
    value: string
}

// The bottom nav is fixed over the page (AppShell mounts it at bottom-0; the
// bar is 68px plus the safe-area inset), so the viewport edge is not the last
// usable pixel. Without this the popper anchors to the window bottom and the
// final option sits under the nav, unreachable — MX_STATES ends on Zacatecas.
const BOTTOM_NAV_CLEARANCE_PX = 112

interface BaseSelectProps {
    options: BaseSelectOption[]
    placeholder?: string
    value?: string
    onValueChange?: (value: string) => void
    onBlur?: () => void
    className?: string
    disabled?: boolean
    error?: boolean
    /** accessible name — the trigger is a button, so a sibling <label htmlFor> cannot name it */
    'aria-label'?: string
}

const BaseSelect = forwardRef<HTMLButtonElement, BaseSelectProps>(
    (
        {
            options,
            placeholder = 'Select...',
            value,
            onValueChange,
            onBlur,
            className,
            disabled,
            error,
            'aria-label': ariaLabel,
        },
        ref
    ) => {
        return (
            <Root
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                onOpenChange={(open) => {
                    // Trigger onBlur when the select closes
                    if (!open && onBlur) {
                        onBlur()
                    }
                }}
            >
                <Trigger
                    ref={ref}
                    aria-label={ariaLabel}
                    className={twMerge(
                        'notranslate flex h-12 w-full items-center justify-between rounded-sm border border-border-default bg-white px-4 text-label-l text-foreground-primary transition-colors outline-none placeholder:text-foreground-secondary',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        // DS input focus pattern (blue ring), not the old pink border
                        'focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid',
                        error && 'border-border-error',
                        className
                    )}
                >
                    <Value
                        placeholder={placeholder}
                        className="text-foreground-primary data-[placeholder]:text-foreground-secondary"
                    />
                    <SelectIcon>
                        <Icon name="chevron-down" className="size-4 text-foreground-primary" />
                    </SelectIcon>
                </Trigger>

                <Portal>
                    <Content
                        className={twMerge(
                            // Cap at the smaller of the design height and the room
                            // Radix measured (which honours collisionPadding below),
                            // so a long list shrinks and scrolls instead of running
                            // under the nav.
                            'relative z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden rounded-sm border border-border-default bg-white shadow-lg'
                        )}
                        position="popper"
                        sideOffset={4}
                        align="start"
                        collisionPadding={{ top: 8, right: 8, bottom: BOTTOM_NAV_CLEARANCE_PX, left: 8 }}
                        style={{ width: 'var(--radix-select-trigger-width)' }}
                        // usePullToRefresh listens on `document` and only bails on window.scrollY > 0,
                        // so scrolling a long list at page top reads as a pull. Same guard as Global/Drawer.
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        <Viewport className="notranslate w-full p-1">
                            {options.map((option) => (
                                <Item
                                    key={option.value}
                                    value={option.value}
                                    className={twMerge(
                                        'relative flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-label-l outline-none select-none',
                                        'transition-colors',
                                        'hover:bg-gray-200 focus:bg-gray-200',
                                        'data-[state=checked]:bg-action-primary data-[state=checked]:text-white'
                                    )}
                                >
                                    <ItemText className="text-label-l">{option.label}</ItemText>
                                    <ItemIndicator className="ml-auto">
                                        <Icon name="check" className="size-4" />
                                    </ItemIndicator>
                                </Item>
                            ))}
                        </Viewport>
                    </Content>
                </Portal>
            </Root>
        )
    }
)

BaseSelect.displayName = 'BaseSelect'

export { BaseSelect }
export default BaseSelect
