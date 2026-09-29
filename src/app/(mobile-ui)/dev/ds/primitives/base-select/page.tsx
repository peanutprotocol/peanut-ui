'use client'

import { useState } from 'react'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function BaseSelectPage() {
    const [value, setValue] = useState('')

    return (
        <DocPage>
            <DocHeader
                title="BaseSelect"
                description="Radix-based dropdown select with error and disabled states."
                status="production"
            />

            <WhenToUse
                use={[
                    'A short fixed list of options — account type, bank code, state',
                    'Inside a Field, with a Controller when react-hook-form owns the value',
                    'Always pass aria-label — the trigger is a button, so a sibling label cannot name it',
                ]}
                dontUse={[
                    'A long list the user must search — use Common/CountryCombobox',
                    'A list you browse, or rows with an icon and a sublabel — use a Drawer with ListItem rows',
                    'The error prop as the message — the text goes in a FieldError under the control',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'options', type: 'Array<{label, value}>', default: '(required)', required: true },
                    { name: 'placeholder', type: 'string', default: "'Select...'" },
                    { name: 'value', type: 'string', default: '(none)' },
                    { name: 'onValueChange', type: '(value: string) => void', default: '(none)' },
                    { name: 'disabled', type: 'boolean', default: 'false' },
                    { name: 'error', type: 'boolean', default: 'false' },
                ]}
            />

            <DocSection title="Default">
                <DocSection.Content>
                    <BaseSelect
                        options={[
                            { label: 'Option 1', value: '1' },
                            { label: 'Option 2', value: '2' },
                            { label: 'Option 3', value: '3' },
                        ]}
                        placeholder="Select an option"
                        value={value}
                        onValueChange={setValue}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import BaseSelect from '@/components/0_Bruddle/BaseSelect'`} />
                    <CodeBlock
                        label="Basic Usage"
                        code={`<BaseSelect
  options={[
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ]}
  value={value}
  onValueChange={setValue}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="States">
                <DocSection.Content>
                    <div className="flex gap-2">
                        <BaseSelect options={[{ label: 'Disabled', value: 'd' }]} placeholder="disabled" disabled />
                        <BaseSelect options={[{ label: 'Error', value: 'e' }]} placeholder="error" error />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="States"
                        code={`<BaseSelect options={[...]} disabled />
<BaseSelect options={[...]} error />`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Bank account form — account type"
                    path="src/components/AddWithdraw/DynamicBankAccountForm.tsx"
                    description="Every select in the dynamic bank form goes through one helper: Field for the label and error, Controller for the value, aria-label because the trigger is a button."
                    code={`<BaseSelect
  options={options}
  aria-label={label}
  placeholder={placeholder}
  value={field.value}
  onValueChange={(value) => {
    markUserEdit()
    field.onChange(value)
  }}
  onBlur={field.onBlur}
  className="h-12 w-full rounded-sm text-body-s"
/>`}
                >
                    <BaseSelect
                        aria-label="Account type"
                        placeholder="Select an account type"
                        options={[
                            { label: 'Checking', value: 'checking' },
                            { label: 'Savings', value: 'savings' },
                        ]}
                        className="h-12 w-full rounded-sm text-body-s"
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Manteca withdraw — bank code"
                    path="src/app/(mobile-ui)/withdraw/manteca/page.tsx"
                    description="Options come from the country config, so the select only mounts for the countries that need a bank code."
                    code={`{countryConfig?.needsBankCode && (
  <BaseSelect
    value={selectedBank?.code}
    onValueChange={(value) => {
      const bank = countryConfig.validBankCodes.find((b) => b.code === value)
      if (bank) setSelectedBank({ code: bank.code, name: bank.name })
    }}
    options={countryConfig.validBankCodes.map((bank) => ({ label: bank.name, value: bank.code }))}
    placeholder={t('manteca.selectBank')}
  />
)}`}
                >
                    <BaseSelect
                        placeholder="Select your bank"
                        options={[
                            { label: 'Banco Galicia', value: '007' },
                            { label: 'Banco Santander', value: '072' },
                            { label: 'Mercado Pago', value: '143' },
                        ]}
                    />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
