import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import CopyToClipboard from '../Global/CopyToClipboard'
import { Tooltip } from '../Tooltip'

export interface PaymentInfoRowProps {
    label: string | React.ReactNode
    value: number | string | React.ReactNode
    moreInfoText?: string
    loading?: boolean
    hideBottomBorder?: boolean
    allowCopy?: boolean
    copyValue?: string
    onClick?: () => void
}

export const PaymentInfoRow = ({
    label,
    value,
    moreInfoText,
    loading,
    hideBottomBorder,
    allowCopy,
    copyValue,
    onClick,
}: PaymentInfoRowProps) => {
    return (
        <div
            className={twMerge(
                'flex w-full flex-col justify-between gap-1 border-b border-dashed border-black py-3 text-h8',
                hideBottomBorder && 'border-none',
                onClick && 'cursor-pointer transition-colors hover:bg-grey-2/30 active:bg-grey-2/50'
            )}
            onClick={onClick}
            translate="no"
        >
            <div className="relative flex items-center">
                <label className={twMerge('text-xs font-semibold')}>{label}</label>
                {moreInfoText && (
                    <div className="relative z-20 flex items-center justify-center px-2">
                        <Tooltip content={moreInfoText} position="right">
                            <Icon name="info" size={12} />
                        </Tooltip>
                    </div>
                )}
            </div>
            {loading ? (
                <Loading />
            ) : (
                <div className="flex items-center justify-between">
                    {/* min-w-0 + break-words: a single unbreakable token (wallet
                        address, tx hash) must wrap inside the card, not stretch
                        the row to the token's full width and escape the layout.
                        break-word only activates when a word can't fit, so
                        normal values render unchanged. */}
                    <div className={twMerge('flex w-fit min-w-0 justify-end break-words text-sm font-bold')}>
                        <span className="min-w-0">{value}</span>
                    </div>
                    {allowCopy && typeof value === 'string' && (
                        <CopyToClipboard textToCopy={copyValue ?? value} fill="black" iconSize="4" />
                    )}
                </div>
            )}
        </div>
    )
}
