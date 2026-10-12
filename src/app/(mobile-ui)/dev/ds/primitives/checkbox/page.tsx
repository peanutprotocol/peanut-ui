'use client'

import { useState } from 'react'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function CheckboxPage() {
    const [checked, setChecked] = useState(false)
    // one piece of local state per product recreation below
    const [acceptedTerm, setAcceptedTerm] = useState(false)
    const [saveAddress, setSaveAddress] = useState(false)

    return (
        <DocPage>
            <DocHeader title="Checkbox" description="Simple checkbox with optional label." status="production" />

            <WhenToUse
                use={[
                    'Opt in before you submit — accept the terms, save this address',
                    'A choice that only takes effect when the form is submitted',
                    'The label prop for one short line; leave it out and put wrapping text or links beside the box',
                ]}
                dontUse={[
                    'A setting that saves the moment it flips — use Toggle',
                    'A trailing control on a list row — the board trailing set has a toggle, not a checkbox',
                    'One choice out of many — use BaseSelect, or a selection list in a Drawer',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'value', type: 'boolean', default: '(required)', required: true },
                    { name: 'onChange', type: '(e: ChangeEvent) => void', default: '(required)', required: true },
                    { name: 'label', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection title="Examples">
                <DocSection.Content>
                    <Checkbox
                        label="I agree to the terms"
                        value={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                    />

                    <div>
                        <Checkbox value={!checked} onChange={() => {}} />
                        <p className="text-body-xs text-foreground-secondary">Without label</p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Checkbox from '@/components/0_Bruddle/Checkbox'`} />
                    <CodeBlock
                        label="With Label"
                        code={`<Checkbox
  label="I agree to the terms"
  value={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>`}
                    />
                    <CodeBlock label="Without Label" code={`<Checkbox value={checked} onChange={() => {}} />`} />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Card — terms and conditions"
                    path="src/components/Card/CardTermsScreen.tsx"
                    description="One unlabeled checkbox per legal term; the term text is a sibling so it can wrap and hold links."
                    code={`<Checkbox
    value={!!checked[term.id]}
    onChange={(e) => setChecked((prev) => ({ ...prev, [term.id]: e.target.checked }))}
    className="mt-0.5"
/>
<div className="flex-1 text-body-s">{term.label}</div>`}
                >
                    <div className="flex items-start gap-2">
                        <Checkbox
                            value={acceptedTerm}
                            onChange={(e) => setAcceptedTerm(e.target.checked)}
                            className="mt-0.5"
                        />
                        <div className="flex-1 text-body-s">
                            I accept the cardholder agreement and the card issuer terms.
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Withdraw — save this address"
                    path="src/features/withdraw/components/AddressBook/SaveAddressPrompt.tsx"
                    description="Labeled checkbox that reveals a nickname input once it is checked."
                    code={`<Checkbox
    label={t('savedAddresses.savePrompt')}
    value={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
/>`}
                >
                    <Checkbox
                        label="Save this address"
                        value={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
