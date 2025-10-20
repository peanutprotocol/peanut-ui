import Icon from '@/components/Global/Icon'
import { Listbox, Transition } from '@headlessui/react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

type SelectItem = {
    id: string
    title: string
}

type SelectProps = {
    label?: string
    className?: string
    classButton?: string
    classArrow?: string
    classOptions?: string
    classOption?: string
    placeholder?: string
    items: SelectItem[]
    value: SelectItem | null
    onChange: (item: SelectItem) => void
    up?: boolean
    small?: boolean
    classPlaceholder?: string
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
}: SelectProps) => {
    const buttonRef = useRef<HTMLButtonElement>(null)

    return (
        <div className={`relative ${className}`}>
            {label && <div className="mb-3 text-xs font-bold">{label}</div>}
            <Listbox value={value || undefined} onChange={onChange}>
                {({ open }) => (
                    <>
                        <Listbox.Button
                            ref={buttonRef}
                            className={twMerge(
                                `notranslate flex h-12 w-full justify-between rounded-sm border border-n-1 bg-white text-sm ${
                                    small ? 'h-6 px-4 text-xs' : ''
                                } ${open ? 'border-primary-1 dark:border-primary-1' : ''} ${classButton}`
                            )}
                        >
                            {value ? (
                                <span className="my-auto ml-4 text-black">{value.title}</span>
                            ) : (
                                <span className="text-gray my-auto ml-4">{placeholder}</span>
                            )}
                            <Icon
                                className={twMerge(
                                    `icon-20 my-auto mr-2 shrink-0 transition-transform dark:fill-white ${
                                        small ? '-mr-2 ml-2' : ''
                                    } ${open ? 'rotate-180' : ''} ${classArrow}`
                                )}
                                name="arrow-bottom"
                            />
                        </Listbox.Button>
                        {open &&
                            buttonRef.current &&
                            createPortal(
                                <Transition leave="transition duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                                    <Listbox.Options
                                        className={twMerge(
                                            `absolute left-0 right-0 mt-1 w-full rounded-sm border border-n-1 bg-white p-2 shadow-lg dark:border-white dark:bg-n-1 ${
                                                small ? 'p-0' : ''
                                            } ${up ? 'bottom-full top-auto mb-1 mt-0' : ''} z-50 ${classOptions}`
                                        )}
                                        style={{
                                            position: 'absolute',
                                            top: buttonRef.current.getBoundingClientRect().bottom + window.scrollY,
                                            left: buttonRef.current.getBoundingClientRect().left + window.scrollX,
                                            width: buttonRef.current.offsetWidth,
                                        }}
                                    >
                                        {items.map((item) => (
                                            <Listbox.Option
                                                className={twMerge(
                                                    `flex cursor-pointer items-start rounded-sm px-3 py-2 text-start text-sm font-bold text-grey-1 transition-colors tap-highlight-color ui-selected:!bg-grey-1/20 ui-selected:!text-n-1 hover:text-n-1 dark:text-white/50 dark:ui-selected:!text-white dark:hover:text-white ${
                                                        small ? '!py-1 !pl-4 text-xs' : ''
                                                    } ${classOption}`
                                                )}
                                                key={item.id}
                                                value={item}
                                            >
                                                {item.title}
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </Transition>,
                                document.body
                            )}
                    </>
                )}
            </Listbox>
        </div>
    )
}

export default Select
