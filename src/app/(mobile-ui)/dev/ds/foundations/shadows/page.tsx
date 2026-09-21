'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ShadowsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Shadows"
                description="Shadow tokens for buttons and cards. All shadows use solid black."
            />

            <DesignNote type="info">
                Purple and stroke buttons include the standard 4px shadow. Pass shadowSize only for an intentional
                override.
            </DesignNote>

            {/* Button shadows */}
            <DocSection title="Button Shadows">
                <DocSection.Content>
                    <div className="flex flex-wrap gap-4">
                        {(['3', '4', '6', '8'] as const).map((s) => (
                            <div key={s} className="text-center">
                                <Button variant="primary" shadowSize={s}>
                                    shadow {s}
                                </Button>
                                <p className="mt-1 text-body-xs text-foreground-secondary">
                                    {s === '4'
                                        ? '160 usages'
                                        : s === '3'
                                          ? '2 usages'
                                          : s === '6'
                                            ? '1 usage'
                                            : '1 usage'}
                                </p>
                            </div>
                        ))}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Button shadow" code={`<Button variant="primary">Label</Button>`} />
                </DocSection.Code>
            </DocSection>

            {/* Card shadows */}
            <DocSection title="Card Shadows">
                <DocSection.Content>
                    <div className="space-y-3">
                        {(['4', '6', '8'] as const).map((s) => (
                            <Card key={s} shadowSize={s} className="p-4">
                                <p className="text-label-l">shadowSize=&quot;{s}&quot;</p>
                            </Card>
                        ))}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Card Shadows" code={`<Card shadowSize="4" className="p-4">content</Card>`} />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
