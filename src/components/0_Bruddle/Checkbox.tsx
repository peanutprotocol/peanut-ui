import Icon from '@/components/Global/Icon'

type CheckboxProps = {
    className?: string
    label?: string
    value: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const Checkbox = ({ className, label, value, onChange }: CheckboxProps) => (
    <label
        className={`group relative inline-flex cursor-pointer select-none items-start tap-highlight-color ${className}`}
    >
        <input
            className="invisible absolute left-0 top-0 opacity-0"
            type="checkbox"
            onChange={onChange}
            checked={value}
        />
        <span
            className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded border border-n-1 transition-colors`}
        >
            <Icon className={`transition-opacity ${value ? 'opacity-100' : 'opacity-0'}`} name="check" />
        </span>
        {label && <span className="ml-2.5 pt-0.75 text-xs font-bold text-n-1 dark:text-white">{label}</span>}
    </label>
)

export default Checkbox
