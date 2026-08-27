import { Icon } from '../Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

type CheckboxProps = {
    className?: string
    label?: string
    value: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const Checkbox = ({ className, label, value, onChange }: CheckboxProps) => (
    <label
        className={`group relative inline-flex cursor-pointer items-start select-none tap-highlight-color ${className}`}
    >
        <input
            className="invisible absolute top-0 left-0 opacity-0"
            type="checkbox"
            onChange={onChange}
            checked={value}
        />
        {/* no figma checkbox board exists yet (form board 17802:61539 has no
            checkbox rows) — styled with semantic tokens, flagged for design */}
        <span
            className={twMerge(
                'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border-default bg-background-default transition-colors duration-instant',
                value && 'bg-action-primary'
            )}
        >
            <Icon
                name="check"
                size={16}
                className={`text-foreground-primary transition-opacity duration-instant ${value ? 'opacity-100' : 'opacity-0'}`}
            />
        </span>
        {label && <span className="ml-2.5 pt-0.75 text-body-xs font-bold text-foreground-primary">{label}</span>}
    </label>
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
export default Checkbox
