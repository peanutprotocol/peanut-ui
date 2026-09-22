'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Field } from '@/components/0_Bruddle/Field'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function FieldPage() {
    const [bic, setBic] = useState('NOTABIC')
    const bicInvalid = bic.length > 0 && bic.length !== 8 && bic.length !== 11

    return (
        <DocPage>
            <DocHeader
                title="Field"
                description="Form-field chrome from the form board (17802:61539): an optional label + control + one helper/error line, gap 4. The error is text only and replaces the helper — Field never paints error borders. The one form-field component: FieldColumn folded into it (kush 2026-09-22). react-hook-form owns the state; wrap the control in a Controller."
                status="production"
            />

            <WhenToUse
                use={[
                    'The chrome of any form control — the one form-field component, labelled or not',
                    'No label and no helper — you get the bare control + error column',
                    'With react-hook-form: wrap the control in a Controller and pass fieldState.error?.message',
                    'One line under the control — the error replaces the helper, never both',
                    'Omit htmlFor when the control is a button trigger (BaseSelect) and give the control an aria-label',
                    'errorId to wire aria-describedby on the control; errorTestId when a test looks the error up by name',
                ]}
                dontUse={[
                    'A flow-level failure — use Callout priority="error"',
                    'An error border on the control — a field error is red text only',
                    'Two messages at once — show the blocking one only',
                ]}
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

            <DocSection
                title="Bare control (no label)"
                description="Omit label and helper to get the control + error column on its own — the shape FieldColumn used to carry. Pass errorId when the control needs aria-describedby, errorTestId when a test looks the error up by name."
            >
                <DocSection.Content>
                    <Field error="Amount is required" errorId="ds-field-bare-error">
                        <BaseInput
                            placeholder="Amount"
                            state="error"
                            aria-describedby="ds-field-bare-error"
                            aria-label="Amount"
                        />
                    </Field>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Bare control"
                        code={`<Field error={errors.amount?.message} errorId="amount-error">
    <BaseInput
        placeholder="Amount"
        state={errors.amount ? 'error' : 'default'}
        aria-describedby={errors.amount ? 'amount-error' : undefined}
    />
</Field>`}
                    />
                </DocSection.Code>
            </DocSection>

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

                <ProductUsage.Example
                    title="Profile — edit a detail"
                    path="src/components/Profile/components/ProfileEditField.tsx"
                    description="The label and its badge sit outside the field, so Field runs bare: it owns the input and its error, and errorId wires aria-describedby on the input."
                    code={`<div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-label-l">{label}</label>
    <Field error={error} errorId={\`\${id}-error\`}>
        <BaseInput
            id={id}
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? \`\${id}-error\` : undefined}
        />
    </Field>
</div>`}
                >
                    <div className="flex flex-col gap-2">
                        <label htmlFor="ds-field-usage-username" className="text-label-l">
                            Username
                        </label>
                        <Field error="That username is taken" errorId="ds-field-usage-username-error">
                            <BaseInput
                                id="ds-field-usage-username"
                                size="sm"
                                defaultValue="kushagra"
                                aria-invalid
                                aria-describedby="ds-field-usage-username-error"
                            />
                        </Field>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — amount step"
                    path="src/components/AddMoney/components/InputAmountStep.tsx"
                    description="Wraps the amount keypad, not a text input, and carries the error-alert test hook. The error is suppressed while the limits card is blocking, so only one message shows at a time. Recreated here with BaseInput in place of AmountInput."
                    code={`{/* only show the field error if limits blocking card is not displayed (warnings can coexist) */}
<Field error={!limitsValidation?.isBlocking ? validationError : undefined} errorTestId="error-alert">
    <AmountInput … />
</Field>`}
                >
                    <Field error="Enter at least $10" errorTestId="error-alert">
                        <BaseInput placeholder="$0.00" state="error" inputMode="decimal" aria-label="Amount" />
                    </Field>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
