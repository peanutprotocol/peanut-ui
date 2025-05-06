import { Menu, Transition } from '@headlessui/react'
import * as _consts from '../Dashboard.consts'

export const SortComponent = ({
    sortingValue,
    setSortingValue,
    buttonClassName,
}: {
    sortingValue: string
    setSortingValue: any
    buttonClassName: string
}) => {
    return (
        <Menu className="relative w-full" as="div">
            <Menu.Button
                className={`btn-purple-2 flex h-max flex-row items-center justify-center px-4 py-2 text-h8 font-normal ${buttonClassName}`}
            >
                Sort by: {sortingValue}
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className=" shadow-4 absolute left-0 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1 ">
                    {_consts.sortingTypes.map((type) => (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                setSortingValue(type)
                            }}
                            className=" flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 dark:hover:bg-white/20"
                            key={type}
                        >
                            <div className="text-h8">{type}</div>
                        </Menu.Item>
                    ))}
                </Menu.Items>
            </Transition>
        </Menu>
    )
}
