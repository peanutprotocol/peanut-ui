import { Menu, Transition } from '@headlessui/react'
import Icon from '../Icon'

interface MoreInfoProps {
    text: string
}

const MoreInfo = ({ text }: MoreInfoProps) => {
    return (
        <Menu className="relative" as="div">
            <>
                <Menu.Button className="flex items-center justify-center">
                    <Icon name={'info'} className={`transition-transform dark:fill-white`} />
                </Menu.Button>
                <Transition
                    enter="transition-opacity duration-150 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-100 ease-out"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Menu.Items className="border-rounded ring-sm absolute bottom-full right-0 z-30 mb-1 mr-1 w-64 bg-white px-3 py-2 shadow-lg md:left-0 md:right-auto">
                        <Menu.Item as={'label'} className={'text-h8 font-normal text-black'}>
                            {text}
                        </Menu.Item>
                    </Menu.Items>
                </Transition>
            </>
        </Menu>
    )
}

export default MoreInfo
