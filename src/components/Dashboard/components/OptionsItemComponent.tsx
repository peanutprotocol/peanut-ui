import { useRouter } from 'next/navigation'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import Icon from '@/components/Global/Icon'
import { Menu, Transition } from '@headlessui/react'
export const OptionsItemComponent = ({ item }: { item: interfaces.IDashboardItem }) => {
    const router = useRouter()

    return (
        <Menu className="relative" as="div">
            <Menu.Button className={''}>
                <Icon name={'dots'} className="cursor-pointer dark:fill-white" />
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className="shadow-primary-4  absolute right-12 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1">
                    {item.type != 'Link Received' && item.status == 'pending' && (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                router.push(`/${(item.link ?? '').split('://')[1].split('/')[1]}`)
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 "
                        >
                            <div className="text-h8">Refund</div>
                        </Menu.Item>
                    )}
                    {item.type === 'Link Received' ||
                        (item.type === 'Link Sent' && (
                            <Menu.Item
                                as={'button'}
                                onClick={() => {
                                    utils.copyTextToClipboardWithFallback(item.link ?? '')
                                }}
                                className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            >
                                <div className="text-h8">Copy link</div>
                            </Menu.Item>
                        ))}
                    {item.attachmentUrl && (
                        <Menu.Item
                            as={'a'}
                            href={item.attachmentUrl}
                            download
                            target="_blank"
                            className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            <div className="text-h8">Download attachment</div>
                        </Menu.Item>
                    )}
                    {item.txHash && (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                utils.copyTextToClipboardWithFallback(item.txHash ?? '')
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            <div className="text-h8">Copy transaction hash</div>
                        </Menu.Item>
                    )}
                </Menu.Items>
            </Transition>
        </Menu>
    )
}
