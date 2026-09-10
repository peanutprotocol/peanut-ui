import { twMerge } from '@/utils/tw'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { Tooltip } from '@/components/Tooltip'

interface DataRowProps {
    label: React.ReactNode
    value: React.ReactNode
    moreInfoText?: string
    loading?: boolean
    allowCopy?: boolean
    copyValue?: string
    onClick?: () => void
    trailing?: React.ReactNode
}

/**
 * Label + value row (DS 09, TX Details board 17490:115877): label left in
 * foreground-secondary, value right-aligned in bold. Rows carry no border
 * logic — the parent card owns the dashed dividers via
 * `divide-y divide-dashed divide-border-default`, so a row never needs to
 * know whether it is last. Was TransactionDetails/ReceiptRow; promoted here
 * so labeled-value rows outside receipts stop hand-rolling the shape.
 */
export const DataRow = ({
    label,
    value,
    moreInfoText,
    loading,
    allowCopy,
    copyValue,
    onClick,
    trailing,
}: DataRowProps) => (
    <div
        className={twMerge(
            'flex w-full items-center justify-between gap-3 py-3',
            onClick &&
                'cursor-pointer transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-disabled'
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
            onClick
                ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onClick()
                      }
                  }
                : undefined
        }
        translate="no"
    >
        <div className="relative flex shrink-0 items-center">
            <span className="text-body-s text-foreground-secondary">{label}</span>
            {moreInfoText && (
                <div className="relative z-20 flex items-center justify-center px-2">
                    <Tooltip content={moreInfoText} position="right">
                        <Icon name="info" size={16} />
                    </Tooltip>
                </div>
            )}
        </div>
        {loading ? (
            <Loading />
        ) : (
            <div className="flex min-w-0 items-center justify-end gap-2 text-right text-label-l text-foreground-primary">
                {/* min-w-0 + break-words: a single unbreakable token (wallet
                    address, tx hash) must wrap inside the card, not stretch
                    the row and escape the layout. */}
                <span className="min-w-0 break-words">{value}</span>
                {allowCopy && typeof value === 'string' && (
                    <CopyToClipboard textToCopy={copyValue ?? value} fill="black" iconSize="4" />
                )}
                {trailing}
            </div>
        )}
    </div>
)
