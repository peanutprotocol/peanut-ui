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
                <p className="text-sm text-grey-1">
                    Always use <code className="font-mono font-bold text-n-1">rounded-sm</code>. This is the standard across all components.
                </p>
                <div className="mt-4 flex gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <div className="size-16 rounded-sm border border-n-1 bg-primary-3/30" />
                        <span className="text-xs font-bold">rounded-sm</span>
                        <span className="text-xs text-grey-1">standard</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <div className="size-16 rounded-full border border-n-1 bg-primary-3/30" />
                        <span className="text-xs font-bold">rounded-full</span>
                        <span className="text-xs text-grey-1">badges, avatars</span>
                    </div>
                </div>
            </DocSection>

            {/* Border styles */}
            <DocSection title="Border Styles">
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <div className="rounded-sm border border-n-1 p-4 text-xs font-bold">border border-n-1</div>
                            <p className="mt-1 text-xs text-grey-1">Standard 1px black border. Most common.</p>
                        </div>
                        <div>
                            <div className="brutal-border rounded-sm p-4 text-xs font-bold">brutal-border</div>
                            <p className="mt-1 text-xs text-grey-1">2px solid black. For emphasis.</p>
                        </div>
                        <div>
                            <div className="rounded-sm border border-n-1/20 p-4 text-xs font-bold">border border-n-1/20</div>
                            <p className="mt-1 text-xs text-grey-1">Subtle border. For code snippets, secondary containers.</p>
                        </div>
                        <div>
                            <div className="rounded-sm border border-dashed border-n-1/30 p-4 text-xs font-bold">border-dashed border-n-1/30</div>
                            <p className="mt-1 text-xs text-grey-1">Dashed border. For drop zones, placeholders.</p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="border-n-1"
                        code='className="rounded-sm border border-n-1"'
                    />
                    <CodeBlock
                        label="brutal-border"
                        code='className="brutal-border rounded-sm"'
                    />
                </DocSection.Code>
            </DocSection>

            {/* Labels */}
            <DocSection title="Label Classes">
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        {['label-stroke', 'label-purple', 'label-yellow', 'label-black', 'label-teal'].map((cls) => (
                            <span
                                key={cls}
                                className={`${cls} inline-block rounded-full px-3 py-1 text-xs font-bold`}
                            >
                                {cls.replace('label-', '')}
                            </span>
                        ))}
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Label Classes"
                        code='className="label-purple rounded-full px-3 py-1 text-xs font-bold"'
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
