'use client'

import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import {
    MANTECA_COUNTRIES_CONFIG,
    MANTECA_ARG_DEPOSIT_NAME,
    MANTECA_ARG_DEPOSIT_CUIT,
} from '@/constants/manteca.consts'

/**
 * Manteca-specific deposit info rows for the receipt's mantecaDepositInfo
 * slot. Owns: deposit address (label is country-specific), alias, plus the
 * Argentina-only Razón Social + CUIT pair.
 *
 * Slotted into the receipt via rowVisibilityConfig.mantecaDepositInfo. The
 * config itself stays in the receipt (it depends on receipt-level state
 * like `isPublic` + `transaction.status`); only the rendering moves here.
 */
export function MantecaDepositInfo({
    transaction,
    country,
}: {
    transaction: TransactionDetails
    /** Resolved from transaction.currency.code by the receipt — passed in to
     *  avoid duplicating the lookup. */
    country: { id: string } | undefined
}) {
    const depositDetails = transaction.extraDataForDrawer?.receipt?.depositDetails
    if (!depositDetails) return null

    return (
        <>
            {depositDetails.depositAddress && (
                <PaymentInfoRow
                    label={
                        country
                            ? (MANTECA_COUNTRIES_CONFIG[country.id]?.depositAddressLabel ?? 'Deposit Address')
                            : 'Deposit Address'
                    }
                    value={depositDetails.depositAddress}
                    allowCopy
                />
            )}
            {depositDetails.depositAlias && (
                <PaymentInfoRow label="Alias" value={depositDetails.depositAlias} allowCopy />
            )}
            {country?.id === 'AR' && (
                <>
                    <PaymentInfoRow label="Razón Social" value={MANTECA_ARG_DEPOSIT_NAME} />
                    <PaymentInfoRow label="CUIT" value={MANTECA_ARG_DEPOSIT_CUIT} />
                </>
            )}
        </>
    )
}
