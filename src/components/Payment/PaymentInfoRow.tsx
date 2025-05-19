import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'

export const PaymentInfoRow = ({
    label,
    value,
    moreInfoText,
    loading,
    hideBottomBorder,
}: {
    label: string | React.ReactNode
    value: number | string | React.ReactNode
    moreInfoText?: string
    loading?: boolean
    hideBottomBorder?: boolean
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
            <div className="relative flex items-center gap-1">
                <label className={twMerge('text-xs font-semibold')}>{label}</label>
                {moreInfoText && (
                    <div
                        className="relative"
                        role="button"
                        tabIndex={0}
                        aria-describedby={tooltipId}
                        onMouseEnter={() => setShowMoreInfo(true)}
                        onMouseLeave={() => setShowMoreInfo(false)}
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
                                className="absolute left-4 top-1/2 z-50 ml-2 w-max max-w-[210px] -translate-y-1/2 transform rounded-sm border border-black bg-white p-3 text-xs font-normal shadow-sm md:max-w-xs"
                                id={tooltipId}
                                role="tooltip"
                                aria-hidden={!showMoreInfo}
                            >
                                <div className="relative">
                                    <div className="absolute -left-5 top-1/2 h-0 w-0 -translate-y-1/2 transform border-b-[9px] border-r-[8px] border-t-[9px] border-b-transparent border-r-black border-t-transparent"></div>
                                    <div className="absolute -left-[19px] top-1/2 z-40 h-0 w-0 -translate-y-1/2 transform border-b-[9px] border-r-[8px] border-t-[9px] border-b-transparent border-r-white border-t-transparent"></div>
                                    {moreInfoText}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {loading ? (
                <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700" />
            ) : (
                <div className="flex items-center gap-1">
                    <div className={twMerge('flex w-fit justify-end text-sm font-bold')}>
                        <span>{value}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
