'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Card from '@/components/Global/Card'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function DataRowPage() {
    return (
        <DocPage>
            <DocHeader
                title="DataRow"
                description="Label + value row (TX Details board 17490:115877). Promoted from TransactionDetails/ReceiptRow — use it for any labeled value, not just receipts."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'label', type: 'ReactNode', default: '(required)' },
                    { name: 'value', type: 'ReactNode', default: '(required)' },
                    {
                        name: 'moreInfoText',
                        type: 'string',
                        default: '(none)',
                        description: 'info tooltip next to the label',
                    },
                    { name: 'loading', type: 'boolean', default: 'false' },
                    {
                        name: 'allowCopy',
                        type: 'boolean',
                        default: 'false',
                        description: 'copy button when value is a string',
                    },
                    { name: 'copyValue', type: 'string', default: 'value' },
                    { name: 'onClick', type: '() => void', default: '(none)', description: 'makes the row a button' },
                    {
                        name: 'trailing',
                        type: 'ReactNode',
                        default: '(none)',
                        description: 'slot after the value (LinkButton, Toggle)',
                    },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <div className="divide-y divide-dashed divide-border-default">
                        <DataRow label="Fee" value="$0.10" />
                        <DataRow label="Address" value="0x1234…abcd" allowCopy copyValue="0x1234abcd" />
                        <DataRow
                            label="Per transaction"
                            value="$500"
                            trailing={<LinkButton onClick={() => {}}>Edit</LinkButton>}
                        />
                        <DataRow label="Rate" value="" loading />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import { DataRow } from '@/components/0_Bruddle/DataRow'`} />
                    <CodeBlock
                        label="Rows in a receipt card"
                        code={`<div className="divide-y divide-dashed divide-border-default">
  <DataRow label={t('rows.fee')} value={feeDisplay} />
  <DataRow label={t('rows.address')} value={address} allowCopy />
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Receipt — transaction details"
                    path="src/components/TransactionDetails/ReceiptDetailsCard.tsx"
                    description="The reference call site. The card owns the dashed dividers and the container-query column widths (receiptDataRowCardClassName); rows carry copy buttons and a fee tooltip."
                    code={`<Card position="solo" className={receiptDataRowCardClassName}>
    <DataRow label={t('rows.created')} value={formatDate(transaction.createdAt)} />
    <DataRow
        label={t('rows.to')}
        value={printableAddress(transaction.userName)}
        allowCopy
        copyValue={transaction.userName}
    />
    <DataRow
        label={t('rows.networkFee')}
        value={transaction.networkFeeDetails!.amountDisplay}
        moreInfoText={transaction.networkFeeDetails!.moreInfoText}
    />
    <DataRow label={tCommon('peanutFee')} value={tCommon('sponsoredByPeanut')} />
</Card>`}
                >
                    <Card position="solo" className={receiptDataRowCardClassName}>
                        <DataRow label="Created" value="Sep 21, 2026, 14:02" />
                        <DataRow label="To" value="0x1f9a…4c7d" allowCopy copyValue="0x1f9a04c7d" />
                        <DataRow
                            label="Network fee"
                            value="$0.01"
                            moreInfoText="Paid to the network to settle the transfer."
                        />
                        <DataRow label="Peanut fee" value="Sponsored by Peanut" />
                    </Card>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Deposit accounts — bank details"
                    path="src/features/deposit-accounts/components/DepositDetailsCard.tsx"
                    description="Same recipe outside a receipt: every bank field is copyable, because the user retypes them into their bank app."
                    code={`<Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
    {mainRows.map((row) => (
        <DataRow key={row.label} label={row.label} value={row.value} allowCopy={row.copyable !== false} />
    ))}
</Card>`}
                >
                    <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                        <DataRow label="Account number" value="8901234567" allowCopy />
                        <DataRow label="Routing number" value="021000021" allowCopy />
                        <DataRow label="Beneficiary" value="Jane Doe" allowCopy />
                    </Card>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Accounts & payments — per-transfer caps"
                    path="src/components/Profile/views/MethodLimits.tsx"
                    description="A per-transfer bank cap is a plain labelled value, so it reads as a receipt row — this replaced a hand-rolled ListItem title/trailing pair."
                    code={`<Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
    {bridgeSummaries.map((summary) => (
        <DataRow
            key={summary.direction}
            label={t(summary.direction === 'deposit' ? 'limits.depositPerTransfer' : 'limits.withdrawalPerTransfer')}
            value={summary.perTransaction}
        />
    ))}
</Card>`}
                >
                    <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                        <DataRow label="Deposit per transfer" value="$10,000" />
                        <DataRow label="Withdrawal per transfer" value="$10,000" />
                    </Card>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
