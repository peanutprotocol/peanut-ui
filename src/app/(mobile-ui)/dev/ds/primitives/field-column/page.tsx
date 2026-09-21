'use client'

import BaseInput from '@/components/0_Bruddle/BaseInput'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function FieldColumnPage() {
    return (
        <DocPage>
            <DocHeader
                title="FieldColumn"
                description="An input and its FieldError stacked 4px apart — the form-field column from the form-field board. Field validation only; page/flow failures stay Callout. Whether it folds into Field is an open question."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'The input control' },
                    {
                        name: 'error',
                        type: 'string | null',
                        default: '(none)',
                        description: 'Validation message — rendered as a FieldError under the input',
                    },
                    { name: 'className', type: 'string', default: '(none)' },
                    {
                        name: 'errorTestId',
                        type: 'string',
                        default: '(none)',
                        description: 'Test hook carried by the FieldError',
                    },
                    { name: 'errorId', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection
                title="Examples"
                description="Compose this instead of respelling the flex/gap utilities at every call site."
            >
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">No error</p>
                            <FieldColumn>
                                <BaseInput placeholder="Amount" />
                            </FieldColumn>
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">With error</p>
                            <FieldColumn error="Amount is required" errorId="field-column-demo-error">
                                <BaseInput
                                    placeholder="Amount"
                                    state="error"
                                    aria-describedby="field-column-demo-error"
                                />
                            </FieldColumn>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<FieldColumn error={errors.amount?.message} errorId="amount-error">\n    <BaseInput\n        placeholder="Amount"\n        state={errors.amount ? 'error' : 'default'}\n        aria-describedby={errors.amount ? 'amount-error' : undefined}\n    />\n</FieldColumn>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
