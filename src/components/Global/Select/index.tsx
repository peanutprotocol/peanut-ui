import { Listbox, Transition } from '@headlessui/react'
import { twMerge } from 'tailwind-merge'
import Icon from '@/components/Global/Icon'

type SelectProps = {
    label?: string
    className?: string
    classButton?: string
    classArrow?: string
    classOptions?: string
    classOption?: string
    placeholder?: string
    items: any
    value: any
    onChange: any
    up?: boolean
    small?: boolean
}

const Select = ({
    label,
    className,
    classButton,
    classArrow,
    classOptions,
    classOption,
    placeholder,
    items,
    value,
    onChange,
    up,
    small,
}: SelectProps) => (
    <div className={`relative ${className}`}>
        {label && <div className="mb-3 text-xs font-bold">{label}</div>}
        <Listbox value={value} onChange={onChange}>
            {({ open }) => (
                <>
                    <Listbox.Button
                        className={twMerge(
                            `flex h-16 w-full items-center rounded-sm border border-n-1 bg-white px-5 text-sm font-bold text-n-1 outline-none transition-colors tap-highlight-color dark:border-white dark:bg-n-1 dark:text-white ${
                                small ? 'h-6 px-4 text-xs' : ''
                            } ${open ? 'border-purple-1 dark:border-purple-1' : ''} ${classButton}`
                        )}
                    >
                        <span className="mr-auto truncate text-black">
                            {value ? value : <span className=" text-n-2 dark:text-white/75">{placeholder}</span>}
                        </span>
                        <Icon
                            className={`icon-20 -mr-0.5 ml-6 shrink-0 transition-transform dark:fill-white ${
                                small ? '-mr-2 ml-2' : ''
                            } ${open ? 'rotate-180' : ''} ${classArrow}`}
                            name="arrow-bottom"
                        />
                    </Listbox.Button>
                    <Transition leave="transition duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <Listbox.Options
                            className={twMerge(
                                `absolute left-0 right-0 mt-1 w-full rounded-sm border border-n-3 bg-white p-2 shadow-lg dark:border-white dark:bg-n-1 ${
                                    small ? 'p-0' : ''
                                } ${up ? 'bottom-full top-auto mb-1 mt-0' : ''} ${open ? 'z-10' : ''} ${classOptions}`
                            )}
                        >
                            {items.map((item: any) => (
                                <Listbox.Option
                                    className={`flex cursor-pointer items-start rounded-sm px-3 py-2 text-sm font-bold text-n-3 transition-colors tap-highlight-color ui-selected:!bg-n-3/20 ui-selected:!text-n-1 hover:text-n-1 dark:text-white/50 dark:ui-selected:!text-white dark:hover:text-white ${
                                        small ? '!py-1 !pl-4 text-xs' : ''
                                    } ${classOption}`}
                                    key={item.chainId}
                                    value={item}
                                >
                                    {item.name}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </Transition>
                </>
            )}
        </Listbox>
    </div>
)

export default Select
