/**
 * select-look trigger for the token selector: a `Field` label over a 48px
 * button that opens a drawer (logo + value + chevron).
 *
 * LOCAL on purpose, pending a DS ruling (TASK-23392): `BaseSelect` only opens
 * a radix dropdown, and a drawer mode on it would be a DS primitive change.
 * The classes copy the BaseSelect trigger (h-12, px-4, rounded-sm, default
 * border, label-l, press outline, 3px focus ring) so the two read as one
 * control; the disabled look is the Input disabled rule.
 */

import { Field } from '@/components/0_Bruddle/Field'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'
import React from 'react'

interface SelectorTriggerProps {
    id: string
    label: string
    value: string
    iconUrl?: string
    helper?: React.ReactNode
    disabled?: boolean
    onClick: () => void
    'data-testid'?: string
}

const SelectorTrigger: React.FC<SelectorTriggerProps> = ({
    id,
    label,
    value,
    iconUrl,
    helper,
    disabled,
    onClick,
    'data-testid': dataTestId,
}) => (
    <Field label={label} htmlFor={id} helper={helper}>
        <button
            id={id}
            type="button"
            aria-haspopup="dialog"
            // the label alone would name it "Token"; the value must be read too
            aria-label={`${label}: ${value}`}
            disabled={disabled}
            onClick={onClick}
            data-testid={dataTestId}
            className={twMerge(
                'notranslate flex h-12 w-full items-center gap-2 rounded-sm border border-border-default bg-background-default px-4 text-left text-label-l text-foreground-primary transition-colors duration-instant outline-none',
                'outline-border-default focus:outline-1 focus:outline-solid focus-visible:border-transparent focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid',
                'disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background-disabled disabled:text-foreground-secondary'
            )}
        >
            {/* the label is "Token" / "Network", so the logo alt stays empty: the value text names it */}
            <DisplayIcon key={iconUrl} iconUrl={iconUrl} altText="" fallbackName={value} sizeClass="size-5" />
            <span className="min-w-0 flex-1 truncate">{value}</span>
            <Icon name="chevron-down" size={16} className="shrink-0" />
        </button>
    </Field>
)

export default SelectorTrigger
