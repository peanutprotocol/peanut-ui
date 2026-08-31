import { twMerge } from '@/utils/tw'

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
    'aria-label'?: string
    'data-testid'?: string
}

/**
 * Switch from the figma toggle board (17802:61532): white pill track with a
 * black border, black knob when on, outlined knob when off, blue focus ring,
 * 40% opacity when disabled. 24px tall with a pseudo-element extending the
 * hit area to 44px.
 */
export const Toggle = ({ checked, onChange, disabled, className, ...props }: ToggleProps) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={twMerge(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-round border border-border-default bg-background-default transition-colors duration-instant after:absolute after:inset-x-0 after:-inset-y-2.5 focus-visible:outline-[3px] focus-visible:outline-action-focus disabled:cursor-not-allowed disabled:opacity-40',
            className
        )}
        {...props}
    >
        <span
            className={twMerge(
                'inline-block size-4 rounded-round transition-transform duration-instant',
                checked
                    ? 'translate-x-6 bg-foreground-primary'
                    : 'translate-x-0.5 border border-border-default bg-background-default'
            )}
        />
    </button>
)
