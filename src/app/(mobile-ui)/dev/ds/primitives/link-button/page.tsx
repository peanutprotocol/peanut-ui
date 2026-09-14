'use client'

import Link from 'next/link'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'

const noop = () => {}

export default function LinkButtonPage() {
    return (
        <DocPage>
            <DocHeader
                title="LinkButton"
                description="Standalone link from the figma link board (17980:17351). Body/XS underlined, gray at rest, black on hover. Navigation only — never an action."
                status="limited"
            />

            <DocSection title="Usage & states">
                <DocSection.Content>
                    <div className="flex flex-col items-start gap-4">
                        <LinkButton onClick={noop}>Default</LinkButton>
                        <LinkButton onClick={noop} icon>
                            View transaction
                        </LinkButton>
                        <LinkButton href="/dev/ds" icon>
                            As a Next.js link
                        </LinkButton>
                        <LinkButton onClick={noop} disabled>
                            Disabled
                        </LinkButton>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="LinkButton"
                        code={`import { LinkButton } from '@/components/0_Bruddle/LinkButton'

<LinkButton href="/history" icon>View transaction</LinkButton>
<LinkButton onClick={openDetails}>See details</LinkButton>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection title="Inline links">
                <DocSection.Content>
                    <p className="text-body-m text-foreground-primary">
                        Inline links inherit the surrounding text:{' '}
                        <Link href="/dev/ds" className="text-foreground-secondary underline">
                            transaction history
                        </Link>{' '}
                        stays in the sentence. Do not embed the standalone LinkButton inline — its fixed size and icon
                        break the sentence.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Inline"
                        code={`You can view your{' '}
<Link href="/history" className="text-foreground-secondary underline">
    transaction history
</Link>{' '}
at any time.`}
                    />
                </DocSection.Code>
            </DocSection>

            <DesignNote type="warning">
                The board colors links foreground/secondary (gray) at rest — the older app law said links are black +
                underline. This page follows the board; the conflict is flagged for a design decision.
            </DesignNote>

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'children', type: 'ReactNode', default: '(required)', description: 'Link text' },
                    {
                        name: 'href',
                        type: 'string',
                        default: '(none)',
                        description: 'Renders a Next.js Link; omit for a button',
                    },
                    { name: 'onClick', type: '() => void', default: '(none)' },
                    { name: 'icon', type: 'boolean', default: 'false', description: 'Trailing arrow-up-right' },
                    { name: 'disabled', type: 'boolean', default: 'false', description: '40% opacity, no clicks' },
                    { name: 'external', type: 'boolean', default: 'false', description: 'Opens href in a new tab' },
                ]}
            />
        </DocPage>
    )
}
