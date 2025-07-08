import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import CopyToClipboard from '../Global/CopyToClipboard'

export const PaymentInfoRow = ({
    label,
    value,
    moreInfoText,
    loading,
    hideBottomBorder,
    allowCopy,
}: {
    label: string | React.ReactNode
    value: number | string | React.ReactNode
    moreInfoText?: string
    loading?: boolean
    hideBottomBorder?: boolean
    allowCopy?: boolean
}) => {
    const [showMoreInfo, setShowMoreInfo] = useState(false)
    const tooltipId = useId()

    return (
        <div
            className={twMerge(
                'flex w-full flex-col justify-between gap-1 border-b border-dashed border-black py-3 text-h8',
                hideBottomBorder && 'border-none'
            )}
        >
            <div className="relative flex items-center">
                <label className={twMerge('text-xs font-semibold')}>{label}</label>
                {moreInfoText && (
                    <div
                        className="relative z-20 flex items-center justify-center px-2"
                        role="button"
                        tabIndex={0}
                        aria-describedby={tooltipId}
                        onFocus={() => setShowMoreInfo(true)}
                        onBlur={() => setShowMoreInfo(false)}
                    >
                        <Icon
                            name="info"
                            className="size-3 cursor-pointer"
                            onClick={() => setShowMoreInfo(!showMoreInfo)}
                        />
                        {showMoreInfo && (
                            <div
                                className="absolute left-5 top-1/2 z-30 ml-2 w-max max-w-[210px] -translate-y-1/2 transform rounded-sm border border-black bg-white p-3 text-xs font-normal shadow-sm md:max-w-xs"
                                id={tooltipId}
                                role="tooltip"
                                aria-hidden={!showMoreInfo}
                            >
                                <div className="relative">
                                    <div className="absolute -left-5 top-1/2 h-0 w-0 -translate-y-1/2 transform border-b-[9px] border-r-[8px] border-t-[9px] border-b-transparent border-r-black border-t-transparent"></div>
                                    <div className="absolute -left-[19px] top-1/2 z-20 h-0 w-0 -translate-y-1/2 transform border-b-[9px] border-r-[8px] border-t-[9px] border-b-transparent border-r-white border-t-transparent"></div>
                                    {moreInfoText}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {loading ? (
                <Loading />
            ) : (
                <div className="flex items-center justify-between">
                    <div className={twMerge('flex w-fit justify-end text-sm font-bold')}>
                        <span>{value}</span>
                    </div>
                    {allowCopy && typeof value === 'string' && (
                        <CopyToClipboard textToCopy={value} fill="black" iconSize="4" />
                    )}
                </div>
            )}
        </div>
    )
}
