import { twMerge } from '@/utils/tw'
import { Icon } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import CopyToClipboard from '../Global/CopyToClipboard'
import { Tooltip } from '../Tooltip'

/**
 * Label/value/copy row for receipts and confirm screens. Rows stack inside a
 * Card, so this does NOT render ListItem (a bordered Card row) — nesting
 * would double borders. Styling is token-only; a receipt-row board decision
 * is flagged for design.
 */
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
                'flex w-full flex-col justify-between gap-1 border-b border-dashed border-border-default py-3',
                hideBottomBorder && 'border-none',
                onClick && 'cursor-pointer transition-colors duration-instant active:bg-background-disabled'
            )}
            onClick={onClick}
            translate="no"
        >
            <div className="relative flex items-center">
                <label className="text-body-xs font-semibold text-foreground-primary">{label}</label>
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
                    <div className="flex w-fit min-w-0 justify-end text-body-s font-bold break-words">
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
