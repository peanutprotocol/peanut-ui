'use client'

import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import MoreInfo from '@/components/Global/MoreInfo'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { resolveBridgeAccountHolderName } from '@/constants/payment.consts'
import { shortDepositReference } from '@/utils/format.utils'
import { formatIban } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

/**
 * Bridge onramp deposit instructions block — multi-country bank fields
 * (US routing/account/beneficiary, EU IBAN/BIC, UK sort code, Mexico CLABE).
 *
 * Slotted into the receipt via rowVisibilityConfig.depositInstructions.
 * The bank details fold behind a link accordion; its open state is local UI
 * state, so it doesn't leak into the parent's state surface.
 *
 * Format selection precedence: IBAN+BIC → Sort+Account → US fallback.
 * Mirrors what Bridge returns in `extraDataForDrawer.depositInstructions`.
 */
export function BridgeDepositInstructions({ transaction }: { transaction: TransactionDetails }) {
    const t = useTranslations('transaction')
    const [openSection, setOpenSection] = useState('')
    const instructions = transaction.extraDataForDrawer?.depositInstructions
    if (!instructions) return null

    return (
        <>
            <DataRow
                label={
                    <div className="flex items-center gap-1">
                        <span>{t('bridge.depositMessage')}</span>
                        <MoreInfo text={t('bridge.depositMessageInfo')} />
                    </div>
                }
                value={
                    <div className="flex items-center gap-2">
                        {/* Same shortened form as the Add Money screen — rationale on
                            shortDepositReference. Showing the full form only here made
                            users think they wired with the "wrong" code. */}
                        <span className="break-all">{shortDepositReference(instructions.deposit_message)}</span>
                        <CopyToClipboard
                            textToCopy={shortDepositReference(instructions.deposit_message)}
                            iconSize="4"
                        />
                    </div>
                }
            />

            <Accordion type="single" collapsible variant="link" value={openSection} onValueChange={setOpenSection}>
                <Accordion.Item value="bank-details">
                    <Accordion.Trigger>
                        {openSection ? t('bridge.hideBankDetails') : t('bridge.seeBankDetails')}
                    </Accordion.Trigger>
                    {/* the rows sit one level below the receipt card now, so the
                        content repeats the card's dashed dividers */}
                    <Accordion.Content
                        flush
                        className="divide-y divide-dashed divide-border-default border-t border-dashed border-border-default"
                    >
                        {/* resolveBridgeAccountHolderName maps Bridge's stale/absent legal entity name to the current one (Sp. Z.o.o. -> S.A.) */}
                        <DataRow
                            label={t('bridge.accountHolderName')}
                            value={resolveBridgeAccountHolderName(instructions.account_holder_name)}
                            allowCopy
                        />
                        <DataRow
                            label={t('bridge.bankName')}
                            value={
                                <div className="flex items-center gap-2">
                                    <span>{instructions.bank_name}</span>
                                    <CopyToClipboard textToCopy={instructions.bank_name} iconSize="4" />
                                </div>
                            }
                        />
                        {/* presence decides, never currency: Mexican SPEI has no bank
                        address, and an empty row with a copy icon reads as missing
                        data (QA 2026-09-24) */}
                        {instructions.bank_address?.trim() && (
                            <DataRow
                                label={t('bridge.bankAddress')}
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{instructions.bank_address}</span>
                                        <CopyToClipboard textToCopy={instructions.bank_address} iconSize="4" />
                                    </div>
                                }
                            />
                        )}

                        {instructions.clabe ? (
                            // Mexican format (SPEI) — CLABE is the canonical 18-digit
                            // bank reference; account/routing aren't applicable.
                            <DataRow
                                label="CLABE"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{instructions.clabe}</span>
                                        <CopyToClipboard textToCopy={instructions.clabe} iconSize="4" />
                                    </div>
                                }
                                allowCopy
                            />
                        ) : instructions.iban && instructions.bic ? (
                            // European format (IBAN/BIC)
                            <>
                                <DataRow
                                    label="IBAN"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span>{formatIban(instructions.iban)}</span>
                                            <CopyToClipboard textToCopy={formatIban(instructions.iban)} iconSize="4" />
                                        </div>
                                    }
                                />
                                <DataRow
                                    label="BIC"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span>{instructions.bic}</span>
                                            <CopyToClipboard textToCopy={instructions.bic} iconSize="4" />
                                        </div>
                                    }
                                />
                            </>
                        ) : instructions.sort_code && instructions.account_number ? (
                            // UK faster_payments format (Sort Code/Account Number)
                            <>
                                <DataRow label={t('bridge.sortCode')} value={instructions.sort_code} allowCopy />
                                <DataRow
                                    label={t('rows.accountNumber')}
                                    value={instructions.account_number}
                                    allowCopy
                                />
                            </>
                        ) : (
                            // US format (Account Number/Routing Number + optional beneficiary).
                            // This branch is the fallback for any payload that doesn't fit
                            // CLABE/IBAN/UK shapes — including future rails Bridge may add.
                            // Each row gates on its own data so a partial payload never
                            // renders or copies `undefined`.
                            <>
                                {instructions.bank_account_number && (
                                    <DataRow
                                        label={t('rows.accountNumber')}
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span>{instructions.bank_account_number}</span>
                                                <CopyToClipboard
                                                    textToCopy={instructions.bank_account_number}
                                                    iconSize="4"
                                                />
                                            </div>
                                        }
                                    />
                                )}
                                {instructions.bank_routing_number && (
                                    <DataRow
                                        label={t('bridge.routingNumber')}
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span>{instructions.bank_routing_number}</span>
                                                <CopyToClipboard
                                                    textToCopy={instructions.bank_routing_number}
                                                    iconSize="4"
                                                />
                                            </div>
                                        }
                                    />
                                )}
                                {instructions.bank_beneficiary_name && (
                                    <DataRow
                                        label={t('bridge.beneficiaryName')}
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span>{instructions.bank_beneficiary_name}</span>
                                                <CopyToClipboard
                                                    textToCopy={instructions.bank_beneficiary_name}
                                                    iconSize="4"
                                                />
                                            </div>
                                        }
                                    />
                                )}
                                {instructions.bank_beneficiary_address && (
                                    <DataRow
                                        label={t('bridge.beneficiaryAddress')}
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span>{instructions.bank_beneficiary_address}</span>
                                                <CopyToClipboard
                                                    textToCopy={instructions.bank_beneficiary_address}
                                                    iconSize="4"
                                                />
                                            </div>
                                        }
                                    />
                                )}
                            </>
                        )}
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
        </>
    )
}
