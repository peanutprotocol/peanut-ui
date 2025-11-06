'use client'

import { forwardRef } from 'react'
import * as Select from '@radix-ui/react-select'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@/components/Global/Icons/Icon'

export interface BaseSelectOption {
    label: string
    value: string
}

interface BaseSelectProps {
    options: BaseSelectOption[]
    placeholder?: string
    value?: string
    onValueChange?: (value: string) => void
    onBlur?: () => void
    className?: string
    disabled?: boolean
    error?: boolean
}

const BaseSelect = forwardRef<HTMLButtonElement, BaseSelectProps>(
    ({ options, placeholder = 'Select...', value, onValueChange, onBlur, className, disabled, error }, ref) => {
        return (
            <Select.Root
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
                <Select.Trigger
                    ref={ref}
                    className={twMerge(
                        'flex h-12 w-full items-center justify-between rounded-sm border border-n-1 bg-white px-4 text-sm font-bold text-n-1 outline-none transition-colors placeholder:text-n-3',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'focus:border-primary-1',
                        error && 'border-error',
                        className
                    )}
                >
                    <Select.Value placeholder={placeholder} className="text-n-1 data-[placeholder]:text-n-3" />
                    <Select.Icon>
                        <Icon name="chevron-down" className="size-4 text-n-1" />
                    </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                    <Select.Content
                        className={twMerge(
                            'relative z-50 max-h-80 overflow-hidden rounded-sm border border-n-1 bg-white shadow-lg'
                        )}
                        position="popper"
                        sideOffset={4}
                        align="start"
                        style={{ width: 'var(--radix-select-trigger-width)' }}
                    >
                        <Select.Viewport className="w-full p-1">
                            {options.map((option) => (
                                <Select.Item
                                    key={option.value}
                                    value={option.value}
                                    className={twMerge(
                                        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm font-bold outline-none',
                                        'transition-colors',
                                        'hover:bg-grey-2 focus:bg-grey-2',
                                        'data-[state=checked]:bg-primary-1 data-[state=checked]:font-bold data-[state=checked]:text-white'
                                    )}
                                >
                                    <Select.ItemText className="text-sm font-bold">{option.label}</Select.ItemText>
                                    <Select.ItemIndicator className="ml-auto">
                                        <Icon name="check" className="size-4" />
                                    </Select.ItemIndicator>
                                </Select.Item>
                            ))}
                        </Select.Viewport>
                    </Select.Content>
                </Select.Portal>
            </Select.Root>
        )
    }
)

BaseSelect.displayName = 'BaseSelect'

export default BaseSelect
