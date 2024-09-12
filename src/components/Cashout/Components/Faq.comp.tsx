import Icon from '@/components/Global/Icon'
import { ListItem, UnorderedList } from '@chakra-ui/react'
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
                        <Menu.Items className="shadow-primary-4 absolute bottom-full  z-30 mb-1 mr-1 w-64 border border-n-1 bg-white px-6 py-3 md:left-0 md:right-auto">
                            <Menu.Item as={'label'} className={' text-h8 font-normal'}>
                                Fees:
                                <br />
                                <UnorderedList title="Fees:" className="space-y-1 pl-3">
                                    <ListItem>Gas is sponsored by Peanut</ListItem>
                                    <ListItem>Minimum cashout amount: $10</ListItem>
                                    <ListItem>Cashout fee of $1 to IBAN </ListItem>
                                    <ListItem>Cashout fee of $0.50 to US accounts (ACH)</ListItem>
                                    <ListItem>Processing time is between 20 minutes and 2 business days</ListItem>
                                    <ListItem>Requires KYC.</ListItem>
                                </UnorderedList>
                            </Menu.Item>
                        </Menu.Items>
                    </Transition>
                </>
            </Menu>
        </div>
    )
}
