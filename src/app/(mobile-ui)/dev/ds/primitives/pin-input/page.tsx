'use client'

import { useState } from 'react'
import PinInput from '@/components/Card/PinInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function PinInputPage() {
    const [value, setValue] = useState('')

    return (
        <DocPage>
            <DocHeader
                title="PinInput"
                description="Filled-dot PIN entry backed by one sr-only numeric input; tapping the dots opens the mobile keyboard. Lives in components/Card (the card PIN flows are its only consumers). Code-only — no figma board; pending a design ruling on a shared PIN/OTP primitive."
                status="limited"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'value', type: 'string', default: '(required)' },
                    { name: 'onChange', type: '(v: string) => void', default: '(required)' },
                    { name: 'length', type: 'number', default: '4' },
                    { name: 'autoFocus', type: 'boolean', default: 'true' },
                    { name: 'disabled', type: 'boolean', default: 'false' },
                ]}
            />

            <DocSection title="Live">
                <DocSection.Content>
                    <div className="flex flex-col gap-2">
                        <PinInput value={value} onChange={setValue} autoFocus={false} />
                        <p className="text-body-s text-foreground-secondary">
                            {value.length === 0 ? 'tap the dots and type' : `${value.length} of 4 digits`}
                        </p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import PinInput from '@/components/Card/PinInput'`} />
                    <CodeBlock label="Usage" code={`<PinInput value={pin} onChange={setPin} />`} />
                </DocSection.Code>
            </DocSection>

            <DocSection title="States">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Empty</p>
                            <PinInput value="" onChange={() => {}} autoFocus={false} />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Partially filled</p>
                            <PinInput value="12" onChange={() => {}} autoFocus={false} />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Filled</p>
                            <PinInput value="1234" onChange={() => {}} autoFocus={false} />
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Disabled (save in flight)</p>
                            <PinInput value="1234" onChange={() => {}} autoFocus={false} disabled />
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Disabled" code={`<PinInput value={pin} onChange={setPin} disabled={saving} />`} />
                </DocSection.Code>
            </DocSection>

            <DocSection title="With FieldError">
                <DocSection.Content>
                    {/* the set/confirm flows stack the input and its error 4px
                        apart (form-field board 17788:19179) */}
                    <div className="flex flex-col items-start gap-1">
                        <PinInput value="1111" onChange={() => {}} autoFocus={false} />
                        <FieldError>No repeating digits (e.g., 1111)</FieldError>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Set/confirm pairing"
                        code={`<div className="flex flex-col gap-1">
    <PinInput value={pin} onChange={setPin} />
    {error && <FieldError>{error}</FieldError>}
</div>`}
                    />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Card — choose your PIN"
                    path="src/components/Card/CardPinSetupFlow.tsx"
                    description="First step. The PIN is validated live once all 4 digits are in, so the rejection reason shows before Continue — and Continue stays disabled until it passes."
                    code={`{/* pin input + its field error form one column, 4px apart (form-field board 17788:19179) */}
<div className="flex flex-col items-center gap-1">
    <PinInput value={first} onChange={setFirst} />
    {choosePinValidation && !choosePinValidation.valid && choosePinValidation.reason && (
        <FieldError>{t(REJECTION_KEYS[choosePinValidation.reason])}</FieldError>
    )}
</div>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <PinInput value="1234" onChange={() => {}} autoFocus={false} />
                        <FieldError>No sequential digits (e.g., 1234)</FieldError>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — confirm your PIN"
                    path="src/components/Card/CardPinSetupFlow.tsx"
                    description="Second step, same column. The input goes disabled while the PIN is being saved, so the dots cannot change under a request in flight."
                    code={`<div className="flex flex-col items-center gap-1">
    <PinInput value={second} onChange={setSecond} disabled={step === 'saving'} />
    {fieldError && <FieldError>{fieldError}</FieldError>}
</div>`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <PinInput value="1234" onChange={() => {}} autoFocus={false} disabled />
                        <FieldError>PINs do not match</FieldError>
                    </div>
                </ProductUsage.Example>

                <p className="text-body-s text-foreground-secondary">
                    Limited usage: <code>CardPinSetupFlow</code> is the only product file that renders PinInput. Both
                    call sites are above.
                </p>
            </ProductUsage>
        </DocPage>
    )
}
