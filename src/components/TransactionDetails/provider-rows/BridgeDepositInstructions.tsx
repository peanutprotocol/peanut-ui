'use client'

import { useState } from 'react'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { Icon } from '@/components/Global/Icons/Icon'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import MoreInfo from '@/components/Global/MoreInfo'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME } from '@/constants/payment.consts'
import { formatIban } from '@/utils/general.utils'

/**
 * Bridge onramp deposit instructions block — multi-country bank fields
 * (US routing/account/beneficiary, EU IBAN/BIC, UK sort code, Mexico CLABE).
 *
 * Slotted into the receipt via rowVisibilityConfig.depositInstructions.
 * Owns its own `showBankDetails` toggle (local UI state) so the toggle
 * doesn't leak into the parent's state surface.
 *
 * Format selection precedence: IBAN+BIC → Sort+Account → US fallback.
 * Mirrors what Bridge returns in `extraDataForDrawer.depositInstructions`.
 */
export function BridgeDepositInstructions({ transaction }: { transaction: TransactionDetails }) {
    const [showBankDetails, setShowBankDetails] = useState(false)
    const instructions = transaction.extraDataForDrawer?.depositInstructions
    if (!instructions) return null

    return (
        <>
            <PaymentInfoRow
                label={
                    <div className="flex items-center gap-1">
                        <span>Deposit Message</span>
                        <MoreInfo text="Make sure you enter this exact message as the transfer concept or description. If it's not included, the deposit can't be processed." />
                    </div>
                }
                value={
                    <div className="flex items-center gap-2">
                        <span>{instructions.deposit_message.slice(0, 10)}</span>
                        <CopyToClipboard textToCopy={instructions.deposit_message.slice(0, 10)} iconSize="4" />
                    </div>
                }
                hideBottomBorder={false}
            />

            {/* Toggle button for bank details */}
            <div className="border-grey-11 border-b pb-3">
                <button
                    onClick={() => setShowBankDetails(!showBankDetails)}
                    className="flex w-full items-center justify-between py-3 text-left text-sm font-normal text-black underline transition-colors"
                >
                    <span>{showBankDetails ? 'Hide bank details' : 'See bank details'}</span>
                    <Icon
                        name="chevron-up"
                        className={`h-4 w-4 transition-transform ${!showBankDetails ? 'rotate-180' : ''}`}
                    />
                </button>
            </div>

            {/* Collapsible bank details */}
            {showBankDetails && (
                <>
                    {/* Fallback to bridge as account holder name — covers faster_payments
                        onramps where bridge doesn't return an account holder name. */}
                    <PaymentInfoRow
                        label="Account Holder Name"
                        value={instructions.account_holder_name || BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME}
                        allowCopy
                        hideBottomBorder={false}
                    />
                    <PaymentInfoRow
                        label="Bank Name"
                        value={
                            <div className="flex items-center gap-2">
                                <span>{instructions.bank_name}</span>
                                <CopyToClipboard textToCopy={instructions.bank_name} iconSize="4" />
                            </div>
                        }
                        hideBottomBorder={true}
                    />
                    <PaymentInfoRow
                        label="Bank Address"
                        value={
                            <div className="flex items-center gap-2">
                                <span>{instructions.bank_address}</span>
                                <CopyToClipboard textToCopy={instructions.bank_address} iconSize="4" />
                            </div>
                        }
                        hideBottomBorder={false}
                    />

                    {instructions.iban && instructions.bic ? (
                        // European format (IBAN/BIC)
                        <>
                            <PaymentInfoRow
                                label="IBAN"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{formatIban(instructions.iban)}</span>
                                        <CopyToClipboard textToCopy={formatIban(instructions.iban)} iconSize="4" />
                                    </div>
                                }
                                hideBottomBorder={true}
                            />
                            <PaymentInfoRow
                                label="BIC"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{instructions.bic}</span>
                                        <CopyToClipboard textToCopy={instructions.bic} iconSize="4" />
                                    </div>
                                }
                                hideBottomBorder={true}
                            />
                        </>
                    ) : instructions.sort_code && instructions.account_number ? (
                        // UK faster_payments format (Sort Code/Account Number)
                        <>
                            <PaymentInfoRow
                                label="Sort Code"
                                value={instructions.sort_code}
                                allowCopy
                                hideBottomBorder
                            />
                            <PaymentInfoRow
                                label="Account Number"
                                value={instructions.account_number}
                                allowCopy
                                hideBottomBorder
                            />
                        </>
                    ) : (
                        // US format (Account Number/Routing Number + optional beneficiary)
                        <>
                            <PaymentInfoRow
                                label="Account Number"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{instructions.bank_account_number}</span>
                                        <CopyToClipboard textToCopy={instructions.bank_account_number!} iconSize="4" />
                                    </div>
                                }
                                hideBottomBorder={false}
                            />
                            <PaymentInfoRow
                                label="Routing Number"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{instructions.bank_routing_number}</span>
                                        <CopyToClipboard textToCopy={instructions.bank_routing_number!} iconSize="4" />
                                    </div>
                                }
                                hideBottomBorder={false}
                            />
                            {instructions.bank_beneficiary_name && (
                                <PaymentInfoRow
                                    label="Beneficiary Name"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span>{instructions.bank_beneficiary_name}</span>
                                            <CopyToClipboard
                                                textToCopy={instructions.bank_beneficiary_name}
                                                iconSize="4"
                                            />
                                        </div>
                                    }
                                    hideBottomBorder={true}
                                />
                            )}
                            {instructions.bank_beneficiary_address && (
                                <PaymentInfoRow
                                    label="Beneficiary Address"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span>{instructions.bank_beneficiary_address}</span>
                                            <CopyToClipboard
                                                textToCopy={instructions.bank_beneficiary_address}
                                                iconSize="4"
                                            />
                                        </div>
                                    }
                                    hideBottomBorder={true}
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </>
    )
}
