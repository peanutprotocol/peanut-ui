'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'

export default function FieldErrorPage() {
    const [value, setValue] = useState('kush!')
    const invalid = /[^a-z0-9]/.test(value)

    return (
        <DocPage>
            <DocHeader
                title="FieldError"
                description="Inline field-level error from the form-field board (17788:19179): Body/XS in foreground-error, 4px under its input. Field validation only — page/flow-level failures keep Callout."
                status="production"
            />

            <WhenToUse
                use={[
                    'A message the user fixes by changing one input',
                    '4px under that input — the test is attribution, not distance',
                    'Reserve the slot height on a vertically centered step, so mounting the error does not shift the layout',
                ]}
                dontUse={[
                    'An API or submission failure — use Callout priority="error", even when it sits next to the CTA',
                    'A flow-blocking failure — use an error step, or Global/BackendErrorScreen for a full page',
                    'Transient background feedback — use useToast',
                ]}
            />

            <DocSection title="With an input">
                <DocSection.Content>
                    <div className="flex flex-col gap-1">
                        <BaseInput
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            state={invalid ? 'error' : 'default'}
                            placeholder="username"
                        />
                        <FieldError>{invalid ? 'Lowercase letters and numbers only.' : undefined}</FieldError>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="FieldError"
                        code={`import { FieldError } from '@/components/0_Bruddle/FieldError'

<div className="flex flex-col gap-1">
    <BaseInput state={error ? 'error' : 'default'} ... />
    <FieldError>{error}</FieldError>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Send — not enough balance"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="The amount input and its error form one column, 4px apart. The error only mounts when the amount passes the balance."
                    code={`{/* amount input + its field error form one column, 4px apart */}
<div className="flex flex-col gap-1">
  <AmountInput ... />
  {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
</div>`}
                >
                    <div className="flex flex-col gap-1">
                        <div className="text-center text-heading-l">$120.00</div>
                        <FieldError>You do not have enough balance.</FieldError>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Signup — username taken"
                    path="src/components/Setup/Views/Signup.tsx"
                    description="The slot keeps its 32px height whether or not the error shows, so mounting it does not re-center the step (F-5)."
                    code={`{/* slot space is always reserved so the error mounting doesn't
    re-center the vertically-centered step block (F-5). min-h-8
    = two 16px body-xs lines, enough for the longest message */}
<div className="min-h-8">{error && <FieldError>{error}</FieldError>}</div>`}
                >
                    <div className="flex flex-col gap-2">
                        <BaseInput defaultValue="kushagra" state="error" />
                        <div className="min-h-8">
                            <FieldError>This username is already taken.</FieldError>
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
