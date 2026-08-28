'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PropsTable } from '../../_components/PropsTable'
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
                            label="Daily limit"
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
        </DocPage>
    )
}
