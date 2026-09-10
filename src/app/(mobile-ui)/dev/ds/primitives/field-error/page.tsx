'use client'

import { useState } from 'react'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function FieldErrorPage() {
    const [value, setValue] = useState('kush!')
    const invalid = /[^a-z0-9]/.test(value)

    return (
        <DocPage>
            <DocHeader
                title="FieldError"
                description="Inline field-level error from the form-field board (17788:19179): Body/XS in foreground-error, 4px under its input. Field validation only — page/flow-level failures keep Notification."
                status="production"
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
        </DocPage>
    )
}
