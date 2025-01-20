import Icon from '@/components/Global/Icon'
import { Listbox, Transition } from '@headlessui/react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

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
    classPlaceholder,
}: SelectProps) => {
    const buttonRef = useRef<HTMLButtonElement>(null)

    return (
        <div className={`relative ${className}`}>
            {label && <div className="mb-3 text-xs font-bold">{label}</div>}
            <Listbox value={value} onChange={onChange}>
                {({ open }) => (
                    <>
                        <Listbox.Button
                            ref={buttonRef}
                            className={twMerge(
                                `border-rounded flex h-16 w-full items-center bg-white px-5 text-sm font-bold text-n-1 outline-none transition-colors tap-highlight-color dark:bg-n-1 dark:text-white ${
                                    small ? 'h-6 px-4 text-xs' : ''
                                } ${open ? 'border-primary-1 dark:border-primary-1' : ''} ${classButton}`
                            )}
                        >
                            <span className="mr-auto truncate text-black">
                                {value ? (
                                    value
                                ) : (
                                    <span className={` dark:text-white/75 ${classPlaceholder}`}>{placeholder}</span>
                                )}
                            </span>
                            <Icon
                                className={twMerge(
                                    `icon-20 -mr-0.5 ml-6 shrink-0 transition-transform dark:fill-white ${
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
                                            `absolute left-0 right-0 mt-1 w-full rounded-md border-2 border-grey-1 bg-white p-2 shadow-lg dark:border-white dark:bg-n-1 ${
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
                                        {items.map((item: any) => (
                                            <Listbox.Option
                                                className={twMerge(
                                                    `flex cursor-pointer items-start rounded-sm px-3 py-2 text-start text-sm font-bold text-grey-1 transition-colors tap-highlight-color ui-selected:!bg-grey-1/20 ui-selected:!text-n-1 hover:text-n-1 dark:text-white/50 dark:ui-selected:!text-white dark:hover:text-white ${
                                                        small ? '!py-1 !pl-4 text-xs' : ''
                                                    } ${classOption}`
                                                )}
                                                key={item.chainId ?? item.code ?? item.id}
                                                value={item.chainId ? item : item.code}
                                            >
                                                {item.name}
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
