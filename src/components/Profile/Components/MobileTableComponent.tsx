import * as utils from '@/utils'
import * as interfaces from '@/interfaces'

export const MobileTableComponent = ({
    key,
    primaryText,
    secondaryText,
    tertiaryText,
    quaternaryText,
    type,
    avatar,
}: interfaces.IProfileTableData) => {
    return (
        <div className="flex w-full flex-row items-center justify-between gap-2 border border-n-1 bg-background px-2 py-4 text-h8 font-normal dark:bg-black">
            {avatar.avatarUrl ? (
                <div className="border border-black border-n-1 p-2">
                    <img alt="" loading="eager" src={avatar.avatarUrl} className="h-8 w-8" />
                </div>
            ) : (
                avatar.iconName && ''
            )}

            <div className=" flex flex w-full flex-col gap-2 " key={key}>
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex w-full max-w-48 flex-col items-start justify-center gap-1">
                        <label className="font-bold">
                            {primaryText.substring(0, 1).toUpperCase()}
                            {primaryText.substring(1).toLowerCase()}
                        </label>
                    </div>
                    <label>{secondaryText}</label>
                </div>
                <div className="flex w-full border-t border-dotted border-black" />
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-col items-start justify-end gap-2 text-start">
                        <label className="font-bold">{tertiaryText}</label>
                    </div>
                    <div className="flex flex-col items-end justify-end gap-2 text-end">
                        <div>
                            {type === 'history' ? (
                                quaternaryText === 'claimed' ? (
                                    <div className="border border-green-3 px-2 py-1 text-center text-green-3">
                                        claimed
                                    </div>
                                ) : (
                                    <div className="border border-gray-1 border-n-1 px-2 py-1 text-gray-1">pending</div>
                                )
                            ) : type === 'contacts' ? (
                                <label className="font-bold">txs: {quaternaryText}</label>
                            ) : (
                                type === 'accounts' && ''
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
