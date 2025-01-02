import { formatAmount } from '@/utils'
import { useState } from 'react'
import Icon from '../Icon'
import InfoRow from '../InfoRow'

const INITIAL_STATE = {
    isExpanded: false,
}

type TRange = {
    min: number | string
    max: number | string
}

interface FeeDescriptionProps {
    estimatedFee: number | string
    networkFee: number | string
    slippageRange?: TRange
    loading?: boolean
}

const FeeDescription = ({ estimatedFee, networkFee, slippageRange, loading }: FeeDescriptionProps) => {
    const [toggleDetailedView, setToggleDetailedView] = useState(INITIAL_STATE)

    const handleExpandToggle = () => {
        setToggleDetailedView((prev) => ({ isExpanded: !prev.isExpanded }))
    }

    if (!slippageRange) {
        return (
            <div className="w-full py-2">
                <InfoRow
                    iconName="gas"
                    label="Network cost"
                    value={`~ $ ${networkFee}`}
                    moreInfoText="This transaction will cost you the displayed amount in network fees."
                    loading={loading}
                />
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Header */}
            <div
                onClick={handleExpandToggle}
                className="flex w-full cursor-pointer items-center justify-between gap-1 p-2 text-h8 text-gray-1 transition-colors duration-200 hover:bg-gray-50"
            >
                <div className="flex items-center gap-1">
                    <Icon name="puzzle" className="h-4 fill-gray-1" />
                    <label className="font-bold">Estimated fee</label>
                </div>
                {loading ? (
                    <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700" />
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-normal">{`~ $ ${formatAmount(estimatedFee)}`}</span>
                        <Icon
                            name={toggleDetailedView.isExpanded ? 'chevron-up' : 'arrow-bottom'}
                            className="h-4 fill-gray-1 transition-all duration-300"
                        />
                    </div>
                )}
            </div>

            {/* Expandable Section */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    toggleDetailedView.isExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="flex flex-col gap-2">
                    <InfoRow
                        iconName="gas"
                        label="Network cost"
                        value={networkFee}
                        moreInfoText="This transaction will cost you the displayed amount in network fees."
                        loading={loading}
                    />

                    <InfoRow
                        iconName="money-out"
                        label="Slippage"
                        value={`~ $ ${slippageRange.min} (max $ ${slippageRange.max})`}
                        moreInfoText="Maximum slippage range set to ensure the transaction goes through. Actual slippage is likely to be lower."
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    )
}

export default FeeDescription
