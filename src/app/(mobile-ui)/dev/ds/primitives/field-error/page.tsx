'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import PinInput from '@/components/Card/PinInput'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'
import { WhenToUse } from '../../_components/WhenToUse'
import { DoDont } from '../../_components/DoDont'

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
                        <BaseInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="username" />
                        <FieldError>{invalid ? 'Lowercase letters and numbers only.' : undefined}</FieldError>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="FieldError"
                        code={`import { FieldError } from '@/components/0_Bruddle/FieldError'

<div className="flex flex-col gap-1">
    <BaseInput ... />
    <FieldError>{error}</FieldError>
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Alignment"
                description="The error belongs to its control, so it starts where the control starts. Under a full-width control (BaseInput, BaseSelect, AmountInput) it is left-aligned to the control's edge — also when the control centers its own content, like AmountInput. Center it only under a narrow control that is itself centered in the column (PinInput). Never center an error under a left-aligned input."
            >
                <DocSection.Content>
                    <DoDont
                        doLabel="Left under a full-width input, centered under a centered PIN"
                        doExample={
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-1">
                                    <BaseInput defaultValue="kush!" aria-label="Username" />
                                    <FieldError>Lowercase letters and numbers only.</FieldError>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <PinInput value="1234" onChange={() => {}} autoFocus={false} />
                                    <FieldError>No sequential digits (e.g., 1234)</FieldError>
                                </div>
                            </div>
                        }
                        dontLabel="Centered under a left-aligned input"
                        dontExample={
                            <div className="flex flex-col gap-1">
                                <BaseInput defaultValue="kush!" aria-label="Username" />
                                <FieldError className="text-center">Lowercase letters and numbers only.</FieldError>
                            </div>
                        }
                    />
                </DocSection.Content>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Send — not enough balance"
                    path="src/features/payments/flows/direct-send/views/SendInputView.tsx"
                    description="The amount input and its error form one column, 4px apart. The input is a full-width box, so the error starts at its left edge even though the amount inside is centered. The error only mounts when the amount passes the balance."
                    code={`{/* amount input + its field error form one column, 4px apart */}
<div className="flex flex-col gap-1">
  <AmountInput ... />
  {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
</div>`}
                >
                    <div className="flex flex-col gap-1">
                        {/* static stand-in for AmountInput (it needs flow context): the full-width bordered box */}
                        <div className="border border-border-default bg-background-default p-4 text-center">
                            <span className="text-heading-big-input">$120.00</span>
                        </div>
                        <FieldError>You do not have enough balance.</FieldError>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — choose a PIN"
                    path="src/components/Card/CardPinSetupFlow.tsx"
                    description="The PIN dots are narrow and centered in the column, so the error centers under them."
                    code={`{/* pin input + its field error form one column, 4px apart */}
<div className="flex flex-col items-center gap-1">
  <PinInput value={first} onChange={setFirst} />
  {rejected && <FieldError>{t(REJECTION_KEYS[reason])}</FieldError>}
</div>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <PinInput value="1234" onChange={() => {}} autoFocus={false} />
                        <FieldError>No sequential digits (e.g., 1234)</FieldError>
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
                        <BaseInput defaultValue="kushagra" />
                        <div className="min-h-8">
                            <FieldError>This username is already taken.</FieldError>
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
