'use client'

import { Root, List, Trigger } from '@radix-ui/react-tabs'
import { twMerge } from '@/utils/tw'
import { TAB_TRIGGER_BASE, useTabsLook } from './TabsLook'

interface SegmentedControlOption {
    value: string
    label: string
}

interface SegmentedControlProps {
    options: SegmentedControlOption[]
    value: string
    onChange: (value: string) => void
    'aria-label'?: string
    /** stretch segments to fill the row (network toggles); off = compact pill row */
    fullWidth?: boolean
    className?: string
}

/**
 * the one segmented control: radix tabs styled as a pill row where the active
 * segment gets the action-primary border + tint. used for period toggles and
 * network selectors — not for content tabs.
 */
const SegmentedControl = ({
    options,
    value,
    onChange,
    fullWidth = false,
    className,
    'aria-label': ariaLabel,
}: SegmentedControlProps) => {
    // null on every shipped screen. Under a /dev/tabs-proposals look this control
    // renders in that look instead, which is what TASK-22707 turns it into when
    // SegmentedControl is deleted and these call sites move to Tabs.
    const look = useTabsLook()

    return (
        <Root value={value} onValueChange={onChange} className={twMerge(fullWidth && 'w-full', className)}>
            <List
                className={twMerge(
                    'flex items-center rounded-sm p-0',
                    look && `items-stretch ${look.list}`,
                    fullWidth && 'w-full'
                )}
                aria-label={ariaLabel}
            >
                {options.map((option) => (
                    <Trigger
                        key={option.value}
                        value={option.value}
                        className={twMerge(
                            look
                                ? `${TAB_TRIGGER_BASE} ${look.trigger}`
                                : 'rounded-sm border border-transparent px-3 py-1.5 text-label-m text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary',
                            fullWidth && 'flex-1'
                        )}
                    >
                        {option.label}
                    </Trigger>
                ))}
            </List>
        </Root>
    )
}

export default SegmentedControl
