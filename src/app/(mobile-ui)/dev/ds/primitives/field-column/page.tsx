'use client'

import BaseInput from '@/components/0_Bruddle/BaseInput'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
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

            <SectionDivider />

            <ProductUsage>
                <ProductUsage.Example
                    title="Profile — edit a detail"
                    path="src/components/Profile/components/ProfileEditField.tsx"
                    description="The label sits outside the column; FieldColumn owns the input and its error, and errorId wires aria-describedby on the input."
                    code={`<div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-label-l">{label}</label>
    <FieldColumn error={error} errorId={\`\${id}-error\`}>
        <BaseInput
            id={id}
            variant="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? \`\${id}-error\` : undefined}
        />
    </FieldColumn>
</div>`}
                >
                    <div className="flex flex-col gap-2">
                        <label htmlFor="field-column-usage-username" className="text-label-l">
                            Username
                        </label>
                        <FieldColumn error="That username is taken" errorId="field-column-usage-username-error">
                            <BaseInput
                                id="field-column-usage-username"
                                variant="sm"
                                defaultValue="kushagra"
                                aria-invalid
                                aria-describedby="field-column-usage-username-error"
                            />
                        </FieldColumn>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — amount step"
                    path="src/components/AddMoney/components/InputAmountStep.tsx"
                    description="Wraps the amount keypad, not a text input, and carries the error-alert test hook. The error is suppressed while the limits card is blocking, so only one message shows at a time. Recreated here with BaseInput in place of AmountInput."
                    code={`{/* only show the field error if limits blocking card is not displayed (warnings can coexist) */}
<FieldColumn error={!limitsValidation?.isBlocking ? validationError : undefined} errorTestId="error-alert">
    <AmountInput … />
</FieldColumn>`}
                >
                    <FieldColumn error="Enter at least $10" errorTestId="error-alert">
                        <BaseInput placeholder="$0.00" state="error" inputMode="decimal" />
                    </FieldColumn>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
