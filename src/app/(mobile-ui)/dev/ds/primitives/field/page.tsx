'use client'

import { useState } from 'react'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Field } from '@/components/0_Bruddle/Field'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

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
        </DocPage>
    )
}
