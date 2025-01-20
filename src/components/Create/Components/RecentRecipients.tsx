import Icon from '@/components/Global/Icon'
import * as utils from '@/utils'

type RecentRecipientsProps = {
    recentRecipients: { address: string; count: number }[]
    isLoading: boolean
    onClick: (address: string) => void
}

const RecentRecipients = ({ recentRecipients, onClick, isLoading }: RecentRecipientsProps) => {
    if (isLoading) {
        return (
            <div className="flex w-full flex-col items-start  justify-center gap-2">
                <label className="text-h7 font-bold text-gray-2">Recents</label>
                {[0, 1, 2].map((idx) => (
                    <div
                        key={idx}
                        className="hover:bg-grey-1/10 flex h-10 w-full flex-row items-center justify-between border border-n-1 p-2 transition-colors"
                    >
                        <div className="flex w-full flex-row items-center justify-between overflow-hidden text-h7">
                            <div className="flex flex-row items-center justify-start gap-2">
                                <div className="h-6 w-6 animate-colorPulse rounded-full bg-slate-700" />

                                <div className="h-6 w-24 animate-colorPulse rounded-full bg-slate-700" />
                            </div>
                            <div className="h-6 w-24 animate-colorPulse rounded-full bg-slate-700" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        recentRecipients.length > 0 && (
            <div className="flex w-full flex-col items-start  justify-center gap-2">
                <label className="text-h7 font-bold text-gray-2">Recents</label>
                {recentRecipients.map((recipient) => (
                    <div
                        key={recipient.address}
                        className="hover:bg-grey-1/10 flex h-10 w-full cursor-pointer flex-row items-center justify-between border border-n-1 p-2 transition-colors"
                        onClick={() => onClick(recipient.address)}
                    >
                        <div className="flex w-full flex-row items-center justify-between overflow-hidden text-h7">
                            <div className="flex flex-row items-center justify-start gap-2">
                                <div className="rounded-full border border-n-1">
                                    <Icon name="profile" className="h-6 w-6" />
                                </div>
                                <div className="truncate">{utils.shortenAddressLong(recipient.address, 6)}</div>
                            </div>
                            <label className="font-normal">
                                {' '}
                                {recipient.count} {recipient.count > 1 ? 'transfers' : 'transfer'}
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        )
    )
}

export default RecentRecipients
