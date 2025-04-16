import AddressLink from '@/components/Global/AddressLink'
import Modal from '@/components/Global/Modal'
import * as interfaces from '@/interfaces'
import { copyTextToClipboardWithFallback, formatDate, formatTokenAmount } from '@/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export const MobileItemComponent = ({
    linkDetail,
    address,
}: {
    linkDetail: interfaces.IDashboardItem
    address: string
}) => {
    const [modalVisible, setModalVisible] = useState(false)
    const router = useRouter()

    return (
        <div
            className="flex w-full flex-col gap-2 border border-n-1 bg-white px-2 py-4 text-h8 font-normal dark:bg-black"
            key={linkDetail?.link ?? linkDetail.txHash ?? '' + Math.random()}
            onClick={() => setModalVisible(true)}
        >
            <div className="flex w-full flex-row items-center justify-between">
                <div className="flex w-full max-w-48 flex-col items-start justify-center gap-1">
                    <label className="font-bold">
                        {linkDetail.type.substring(0, 1).toUpperCase()}
                        {linkDetail.type.substring(1).toLowerCase()}
                    </label>
                    <span
                        className="block max-w-48 flex-grow overflow-hidden text-ellipsis whitespace-nowrap text-h9 font-normal"
                        title={linkDetail.message ? linkDetail.message : ''}
                    >
                        {linkDetail.message ? linkDetail.message : ''}
                    </span>
                </div>

                <label>{formatDate(new Date(linkDetail.date))}</label>
            </div>
            <div className="flex w-full border-t border-dotted border-black" />
            <div className="flex w-full flex-row items-end justify-between">
                <div className="flex flex-col items-start justify-end gap-2 text-start">
                    <label className="font-bold">
                        {formatTokenAmount(Number(linkDetail.amount), 4)} {linkDetail.tokenSymbol} - [
                        {linkDetail.chain}]
                    </label>

                    <label>
                        From: <AddressLink address={linkDetail.address ?? address} />
                    </label>
                </div>
                <div className="flex flex-col items-end justify-end gap-2 text-end">
                    <div>
                        {linkDetail.status === 'claimed' ? (
                            <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">claimed</div>
                        ) : (
                            <div className="border border-grey-1 px-2 py-1 text-grey-1">pending</div>
                        )}
                    </div>
                </div>
            </div>
            <Modal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title="Options"
                classWrap="bg-background"
            >
                <div className="flex w-full flex-col items-center justify-center p-2 "></div>
                {linkDetail.type === 'Link Sent' && (
                    <div className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 ">
                        <div
                            className="text-h8"
                            onClick={() => {
                                linkDetail.link && router.push(`/${linkDetail?.link.split('://')[1].split('/')[1]}`)
                            }}
                        >
                            Refund
                        </div>
                    </div>
                )}
                <div
                    onClick={() => {
                        copyTextToClipboardWithFallback(linkDetail?.link ?? linkDetail.txHash ?? '')
                    }}
                    className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                >
                    <div className="text-h8">Copy Link</div>
                </div>
                {linkDetail.attachmentUrl && (
                    <a
                        href={linkDetail.attachmentUrl}
                        download
                        target="_blank"
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 focus:outline-none disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                    >
                        Download attachment
                    </a>
                )}
            </Modal>
        </div>
    )
}
