'use client'

import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function BordersPage() {
    return (
        <DocPage>
            <DocHeader title="Borders" description="Border radius, border styles, and the brutal-border pattern." />

            {/* Border radius */}
            <DocSection title="Border Radius">
                <p className="text-body-s text-foreground-secondary">
                    Always use <code className="font-mono font-bold text-foreground-primary">rounded-sm</code>. This is
                    the standard across all components.
                </p>
                <div className="mt-4 flex gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <div className="size-16 rounded-sm border border-border-default bg-background-badge-accent/30" />
                        <span className="text-label-m">rounded-sm</span>
                        <span className="text-body-xs text-foreground-secondary">standard</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <div className="size-16 rounded-round border border-border-default bg-background-badge-accent/30" />
                        <span className="text-label-m">rounded-round</span>
                        <span className="text-body-xs text-foreground-secondary">badges, avatars</span>
                    </div>
                </div>
            </DocSection>

            {/* Border styles */}
            <DocSection title="Border Styles">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <div className="rounded-sm border border-border-default p-4 text-label-m">
                                border border-border-default
                            </div>
                            <p className="mt-1 text-body-xs text-foreground-secondary">
                                Standard 1px black border. Most common.
                            </p>
                        </div>
                        <div>
                            <div className="brutal-border rounded-sm p-4 text-label-m">brutal-border</div>
                            <p className="mt-1 text-body-xs text-foreground-secondary">
                                2px solid black. For emphasis.
                            </p>
                        </div>
                        <div>
                            <div className="rounded-sm border border-border-disabled p-4 text-label-m">
                                border border-border-disabled
                            </div>
                            <p className="mt-1 text-body-xs text-foreground-secondary">
                                Subtle border. For code snippets, secondary containers.
                            </p>
                        </div>
                        <div>
                            <div className="rounded-sm border border-dashed border-border-subtle p-4 text-label-m">
                                border-dashed border-border-subtle
                            </div>
                            <p className="mt-1 text-body-xs text-foreground-secondary">
                                Dashed border. For drop zones, placeholders.
                            </p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="border-border-default"
                        code='className="rounded-sm border border-border-default"'
                    />
                    <CodeBlock label="brutal-border" code='className="brutal-border rounded-sm"' />
                </DocSection.Code>
            </DocSection>

            {/* Labels */}
            <DocSection title="Label Classes">
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        {['label-stroke', 'label-purple', 'label-yellow', 'label-black', 'label-teal'].map((cls) => (
                            <span key={cls} className={`${cls} inline-block rounded-round px-3 py-1 text-label-m`}>
                                {cls.replace('label-', '')}
                            </span>
                        ))}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Label Classes"
                        code='className="label-purple rounded-round px-3 py-1 text-label-m"'
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
