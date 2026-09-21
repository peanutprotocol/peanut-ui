'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Field } from '@/components/0_Bruddle/Field'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { SectionDivider } from '../../_components/SectionDivider'
import { ProductUsage } from '../../_components/ProductUsage'

export default function FieldPage() {
    const [bic, setBic] = useState('NOTABIC')
    const bicInvalid = bic.length > 0 && bic.length !== 8 && bic.length !== 11

    return (
        <DocPage>
            <DocHeader
                title="Field"
                description="Form-field chrome from the form board (17802:61539): label + control + one helper/error line, gap 4. The error is text only and replaces the helper — Field never paints error borders. react-hook-form owns the state; wrap the control in a Controller."
                status="production"
            />

            <DocSection title="Label + helper">
                <DocSection.Content>
                    <Field label="IBAN" htmlFor="ds-field-iban" helper="The account you withdraw to.">
                        <BaseInput id="ds-field-iban" placeholder="DE89 3704 0044 0532 0130 00" />
                    </Field>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Field"
                        code={`import { Field } from '@/components/0_Bruddle/Field'

<Field label="IBAN" htmlFor="iban" helper="The account you withdraw to.">
    <BaseInput id="iban" ... />
</Field>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Error replaces helper (text only, no borders)">
                <DocSection.Content>
                    <Field
                        label="BIC"
                        htmlFor="ds-field-bic"
                        helper="8 or 11 characters"
                        error={bicInvalid ? 'A BIC has 8 or 11 characters.' : undefined}
                    >
                        <BaseInput id="ds-field-bic" value={bic} onChange={(e) => setBic(e.target.value)} />
                    </Field>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="With react-hook-form"
                        code={`<Controller
    name="bic"
    control={control}
    rules={{ validate: ... }}
    render={({ field, fieldState }) => (
        <Field label="BIC" htmlFor="bic" error={fieldState.error?.message}>
            <BaseInput id="bic" {...field} />
        </Field>
    )}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="Card — edit the spending limit"
                    path="src/components/Card/CardLimitEditDrawer.tsx"
                    description="Label + amount input with a $ leading slot. The validation error replaces the helper line; the input keeps its own border."
                    code={`<Field label={label} htmlFor="card-limit-input" error={validationError} className="text-left">
  <BaseInput
    id="card-limit-input"
    type="number"
    inputMode="decimal"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    leftContent={<span className="text-foreground-secondary">$</span>}
    min={0.01}
    step="0.01"
    disabled={saving}
  />
</Field>`}
                >
                    <Field
                        label="Daily limit"
                        htmlFor="ds-field-card-limit"
                        error="The limit cannot pass $5,000.00."
                        className="text-left"
                    >
                        <BaseInput
                            id="ds-field-card-limit"
                            type="number"
                            inputMode="decimal"
                            defaultValue="8000"
                            leftContent={<span className="text-foreground-secondary">$</span>}
                        />
                    </Field>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Bank account form — a select in the field"
                    path="src/components/AddWithdraw/DynamicBankAccountForm.tsx"
                    description="The control is a Radix trigger, not an input, so the field passes the label through aria-label instead of htmlFor. react-hook-form owns the value."
                    code={`// the trigger is a button, so htmlFor cannot name it — aria-label does
<Field label={label} error={errors[name] && touchedFields[name] ? errors[name]?.message : undefined}>
  <Controller
    name={name}
    control={control}
    rules={rules}
    render={({ field }) => (
      <BaseSelect options={options} aria-label={label} placeholder={placeholder} ... />
    )}
  />
</Field>`}
                >
                    <Field label="Account type">
                        <BaseSelect
                            aria-label="Account type"
                            placeholder="Select an account type"
                            options={[
                                { label: 'Checking', value: 'checking' },
                                { label: 'Savings', value: 'savings' },
                            ]}
                            className="h-12 w-full rounded-sm text-body-s"
                        />
                    </Field>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
