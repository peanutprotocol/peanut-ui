'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'
import Card from '@/components/Global/Card'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'
import { PropsTable } from '../../_components/PropsTable'
import { ProductUsage } from '../../_components/ProductUsage'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { WhenToUse } from '../../_components/WhenToUse'

export default function DataRowGroupPage() {
    return (
        <DocPage>
            <DocHeader
                title="DataRowGroup"
                description="One theme of rows inside a receipt or confirm card. The card's divide-y draws one dashed divider between groups and none inside a group (receipt-rows ruling, 2026-10-02)."
                status="production"
            />

            <WhenToUse
                use={[
                    'Rows of one theme in a receipt or confirm card: who, money, trace',
                    'A group whose rows are all conditional — it renders nothing when none survive',
                ]}
                dontUse={[
                    'Its own borders or padding — the parent card owns px-4 py-0 and the dashed dividers',
                    'ListItem rows — groups of those are ListGroup',
                    'A card with one theme — plain DataRows need no group',
                ]}
            />

            <SectionDivider />

            <PropsTable rows={[{ name: 'children', type: 'ReactNode', default: '(required)' }]} />

            <DocSection title="Examples">
                <DocSection.Content>
                    <Card position="solo" className={receiptDataRowCardClassName}>
                        <DataRowGroup>
                            <DataRow label="Account owner" value="Demo User" />
                            <DataRow label="IBAN" value="ES27 0075 0984 2206 0708 02" />
                        </DataRowGroup>
                        <DataRowGroup>
                            <DataRow label="Exchange rate" value="1 USD = 1.0000 EUR" />
                            <DataRow label="Fee" value="$0" />
                            <DataRow label="Provider" value="Bridge" />
                        </DataRowGroup>
                    </Card>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'`}
                    />
                    <CodeBlock
                        label="Two themes, one divider"
                        code={`<Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
  <DataRowGroup>
    <DataRow label={t('bank.accountOwner')} value={owner} />
    <DataRow label={t('bank.iban')} value={iban} />
  </DataRowGroup>
  <DataRowGroup>
    <DataRow label={tCommon('exchangeRate')} value={rate} />
    <DataRow label={t('bank.fee')} value="$0" />
    <ProviderRow providerId={providerId} />
  </DataRowGroup>
</Card>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Receipt — transaction details"
                    path="src/components/TransactionDetails/ReceiptDetailsCard.tsx"
                    description="Who, money, trace and other, in that order. The provider row closes the money group."
                    code={`<Card position="solo" className={receiptDataRowCardClassName}>
    <DataRowGroup>{/* who */}</DataRowGroup>
    <DataRowGroup>{/* money, provider last */}</DataRowGroup>
    <DataRowGroup>{/* trace: dates, ids */}</DataRowGroup>
</Card>`}
                >
                    <Card position="solo" className={receiptDataRowCardClassName}>
                        <DataRowGroup>
                            <DataRow label="Account number" value="**** 8030" />
                        </DataRowGroup>
                        <DataRowGroup>
                            <DataRow label="Fee" value="$20" />
                            <DataRow label="Bank receives" value="$80" />
                            <DataRow label="Provider" value="Bridge" />
                        </DataRowGroup>
                        <DataRowGroup>
                            <DataRow label="Completed" value="Aug 14, 2026 10:00" />
                            <DataRow label="Transfer ID" value="FIXTURE-WIRE" allowCopy />
                        </DataRowGroup>
                    </Card>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Withdraw — bank review"
                    path="src/features/withdraw/views/WithdrawBankReviewView.tsx"
                    description="The destination, then what moves. USD adds an Arrives group between them."
                    code={`<DataRowGroup>
    <DataRow label={t('bank.accountOwner')} value={owner} />
    <DataRow label={t('bank.accountNumber')} value={account} />
    <DataRow label={t('bank.sortCode')} value={sortCode} />
</DataRowGroup>
<DataRowGroup>
    <DataRow label={tCommon('exchangeRate')} value={rate} moreInfoText={tRate('approximate')} />
    <DataRow label={t('bank.fee')} value="$0" />
    <ProviderRow providerId={providerId} />
</DataRowGroup>`}
                >
                    <Card position="solo" className={receiptDataRowCardClassName}>
                        <DataRowGroup>
                            <DataRow label="Account owner" value="Demo User" />
                            <DataRow label="Account number" value="55555555" />
                            <DataRow label="Sort code" value="202015" />
                        </DataRowGroup>
                        <DataRowGroup>
                            <DataRow label="Exchange rate" value="1 USD = 0.8955 GBP" />
                            <DataRow label="Fee" value="$0" />
                            <DataRow label="Provider" value="Bridge" />
                        </DataRowGroup>
                    </Card>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
