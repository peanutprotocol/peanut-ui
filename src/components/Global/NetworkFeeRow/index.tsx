'use client'

import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { formatNetworkFee } from '@/utils/cross-chain-fee.utils'
import { useTranslations } from 'next-intl'

/**
 * The one network-fee row for confirm screens. Reads the quote's `feeUsd`
 * verbatim (no arithmetic here) and renders the sponsored label, the
 * struck-through sponsored gas, or the formatted fee — the same way on every
 * screen (DS audit: "Fee row 'Sponsored by Peanut!' recipe").
 */
interface NetworkFeeRowProps {
    label: string
    /** Rhino's quoted total fee, verbatim from the hook. Undefined before a
     *  quote resolves or on same-chain transfers. */
    feeUsd?: number
    isCrossChain: boolean
    loading?: boolean
    moreInfoText?: string
    /** Gas the paymaster covers on a same-chain send — shown struck through
     *  next to the sponsored label when it reaches a cent. */
    sponsoredGasUsd?: number
    /** Route or fee estimation failed — shows a dash instead of a number. */
    estimationFailed?: boolean
    hideBottomBorder?: boolean
}

export default function NetworkFeeRow({
    label,
    feeUsd,
    isCrossChain,
    loading,
    moreInfoText,
    sponsoredGasUsd,
    estimationFailed,
    hideBottomBorder,
}: NetworkFeeRowProps) {
    const tCommon = useTranslations('common')
    const fee = formatNetworkFee(feeUsd, isCrossChain)

    let value: React.ReactNode
    if (estimationFailed) {
        value = '-'
    } else if (fee !== null) {
        value = fee
    } else if (sponsoredGasUsd !== undefined && sponsoredGasUsd >= 0.01) {
        value = (
            <>
                <span className="line-through">$ {sponsoredGasUsd.toFixed(2)}</span>
                {' - '}
                <span className="font-medium text-foreground-secondary">{tCommon('sponsoredByPeanut')}</span>
            </>
        )
    } else {
        value = tCommon('sponsoredByPeanut')
    }

    return (
        <PaymentInfoRow
            label={label}
            value={value}
            loading={loading}
            moreInfoText={moreInfoText}
            hideBottomBorder={hideBottomBorder}
        />
    )
}
