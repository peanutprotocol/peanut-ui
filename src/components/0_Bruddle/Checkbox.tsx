import Icon from '@/components/Global/Icon'

type CheckboxProps = {
    className?: string
    label?: string
    value: any
    onChange: any
}

const Checkbox = ({ className, label, value, onChange }: CheckboxProps) => (
    <label
        className={`group relative inline-flex cursor-pointer select-none items-start tap-highlight-color ${className}`}
    >
        <input
            className="invisible absolute left-0 top-0 opacity-0"
            type="checkbox"
            value={value}
            onChange={onChange}
            checked={value}
        />
        <span
            className={`relative flex h-5 w-5 shrink-0 items-center justify-center border transition-colors group-hover:border-green-1 dark:border-white ${
                value ? 'border-green-1 bg-green-1 dark:!border-green-1' : 'border-n-1 bg-transparent dark:border-white'
            }`}
        >
            <Icon className={`fill-white transition-opacity ${value ? 'opacity-100' : 'opacity-0'}`} name="check" />
        </span>
        {label && <span className="ml-2.5 pt-0.75 text-xs font-bold text-n-1 dark:text-white">{label}</span>}
    </label>
)

export default Checkbox
