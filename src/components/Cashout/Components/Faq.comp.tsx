import { CrispButton } from '@/components/CrispChat'
import Icon from '@/components/Global/Icon'
import { Menu, Transition } from '@headlessui/react'

export const FAQComponent = ({ className }: { className?: string }) => {
    return (
        <div className={`flex w-full items-center justify-start gap-1 text-left text-h8 ${className}`}>
            FAQ{' '}
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
                        <Menu.Items className="shadow-primary-4 absolute bottom-full z-[10000] mb-1 mr-1 w-64 border border-n-1 bg-white px-6 py-3 md:left-0 md:right-auto">
                            <Menu.Item as={'div'} className={'text-h8 font-normal'}>
                                <p>
                                    Cashing out requires KYC. <br></br>Min cashout: $10, max $100k.
                                </p>
                                <br></br>
                                <p>Fees:</p>
                                <ul className="list-disc pl-5">
                                    <li>Peanut sponsors gas</li>
                                    <li>We have to charge a $1 fee for EU cashouts, and $0.5 for US transfers</li>
                                </ul>
                                <br></br>
                                <p>Usually takes 20mins, but can take up to 3 business days.</p>
                                <CrispButton className="mt-2 text-blue-600 underline">
                                    Need help? Chat with support
                                </CrispButton>
                            </Menu.Item>
                        </Menu.Items>
                    </Transition>
                </>
            </Menu>
        </div>
    )
}
