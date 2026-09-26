'use client'

import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

export default function MiniHeaderPage() {
    return (
        <DocPage>
            <DocHeader
                title="MiniHeader"
                description="Grey uppercase mini-header that labels a block of plain prose. Code-only — pending a design ruling."
                status="limited"
            />

            <WhenToUse
                use={[
                    'A quiet label over a block of plain prose — form groups, drawer copy',
                    'Splitting a long form into two or three short questions',
                    'A label on an element you cannot swap — apply MINI_HEADER_CLASS instead',
                    'Copy that is neither a warning nor a caveat, so it needs no tint',
                ]}
                dontUse={[
                    'A heading over a list or a card stack — use Section',
                    'A title with a supporting line — use TitleBlock',
                    'A warning, a caveat, or a flow-level failure — use Callout',
                    'A variant of it — the label is the whole component, and it is code-only pending a design ruling; flag the gap instead',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'The label text' },
                    { name: 'className', type: 'string', default: '(none)' },
                ]}
            />

            <DocSection
                title="Examples"
                description="Renders an h3 with the label-m uppercase secondary treatment. MINI_HEADER_CLASS exposes the same classes for an element you cannot swap."
            >
                <DocSection.Content>
                    <div>
                        <MiniHeader>How it works</MiniHeader>
                        <p className="mt-2 text-body-s text-foreground-secondary">
                            Plain prose under a quiet grey label. The header carries no icon, no tint, and no border —
                            just the uppercase label token.
                        </p>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { MiniHeader, MINI_HEADER_CLASS } from '@/components/0_Bruddle/MiniHeader'`}
                    />
                    <CodeBlock label="Usage" code={`<MiniHeader>How it works</MiniHeader>`} />
                    <CodeBlock label="Raw classes" code={`<legend className={MINI_HEADER_CLASS}>Details</legend>`} />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Withdraw — bank account form groups"
                    path="src/components/AddWithdraw/DynamicBankAccountForm.tsx"
                    description="Two headers split six fields into two short questions: what the money is paid into, and who owns the account."
                    code={`{/* The account: what the money is paid into. Grouped so the
    screen reads as two short questions instead of six fields. */}
<div className="flex flex-col gap-4">
    <MiniHeader>{t('groupBankAccount')}</MiniHeader>
    {/* account fields */}
</div>
<div className="flex flex-col gap-4">
    <MiniHeader>{t('groupAccountOwner')}</MiniHeader>
    {/* owner fields */}
</div>`}
                >
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <MiniHeader>Bank account</MiniHeader>
                            <p className="text-body-s text-foreground-secondary">IBAN, BIC</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <MiniHeader>Account owner</MiniHeader>
                            <p className="text-body-s text-foreground-secondary">Full name, address, country</p>
                        </div>
                    </div>
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Add money — onramp confirmation drawer"
                    path="src/components/AddMoney/components/OnrampConfirmationModal.tsx"
                    description="Two topics, two grey headers, plain prose under each. Neither is a warning, which keeps the single Callout slot free for the real one."
                    code={`<div className="flex flex-col gap-1">
    <MiniHeader>{t('nextStep')}</MiniHeader>
    <p className="text-body-s text-foreground-primary">{t('bankDetailsItem')}</p>
    <p className="text-body-s text-foreground-primary">{t('referenceCodeItem')}</p>
</div>
<div className="flex flex-col gap-1">
    <MiniHeader>{t('youMust')}</MiniHeader>
    <p className="text-body-s text-foreground-primary">{t('copyReferenceCode')}</p>
    <p className="text-body-s text-foreground-primary">{t('pasteReference')}</p>
</div>`}
                >
                    <div className="flex flex-col gap-4 text-left">
                        <div className="flex flex-col gap-1">
                            <MiniHeader>Next step</MiniHeader>
                            <p className="text-body-s text-foreground-primary">We show you the bank details</p>
                            <p className="text-body-s text-foreground-primary">And a reference code</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <MiniHeader>Required</MiniHeader>
                            <p className="text-body-s text-foreground-primary">
                                Copy the one-time reference code exactly
                            </p>
                            <p className="text-body-s text-foreground-primary">
                                Paste it in the description/reference field
                            </p>
                        </div>
                    </div>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
