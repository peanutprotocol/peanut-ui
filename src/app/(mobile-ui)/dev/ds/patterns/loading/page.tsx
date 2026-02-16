'use client'

import Loading from '@/components/Global/Loading'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function LoadingPage() {
    return (
        <DocPage>
            <DocHeader
                title="Loading"
                description="CSS spinner (Loading) for inline/button use, and branded Peanut logo spinner (PeanutLoading) for full-page or section loading states."
                status="production"
            />

            {/* Loading (CSS Spinner) */}
            <DocSection title="Loading (CSS Spinner)">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Minimal CSS-only spinner. Uses border animation. Size controlled via className.
                    </p>

                    <div className="space-y-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-grey-1">Sizes</p>
                        <div className="flex items-end gap-6">
                            <div className="text-center">
                                <Loading className="h-3 w-3" />
                                <p className="mt-2 text-xs text-grey-1">h-3 w-3</p>
                            </div>
                            <div className="text-center">
                                <Loading />
                                <p className="mt-2 text-xs text-grey-1">h-4 w-4 (default)</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-6 w-6" />
                                <p className="mt-2 text-xs text-grey-1">h-6 w-6</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-8 w-8" />
                                <p className="mt-2 text-xs text-grey-1">h-8 w-8</p>
                            </div>
                            <div className="text-center">
                                <Loading className="h-12 w-12" />
                                <p className="mt-2 text-xs text-grey-1">h-12 w-12</p>
                            </div>
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'className', type: 'string', default: "'h-4 w-4'", description: 'Controls size via Tailwind width/height' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Loading from '@/components/Global/Loading'`} />

                    <CodeBlock label="Usage" code={`<Loading />                     {/* default 16px */}
<Loading className="h-8 w-8" /> {/* 32px */}`} />
                </DocSection.Code>
            </DocSection>

            {/* PeanutLoading */}
            <DocSection title="PeanutLoading (Branded)">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Spinning Peanut logo with optional message. Can cover the full screen as an overlay.
                    </p>

                    {/* Inline demo */}
                    <div className="space-y-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-grey-1">Inline</p>
                        <div className="rounded-sm border border-n-1 p-4">
                            <PeanutLoading message="Processing your transaction..." />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-grey-1">Without message</p>
                        <div className="rounded-sm border border-n-1 p-4">
                            <PeanutLoading />
                        </div>
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'coverFullScreen', type: 'boolean', default: 'false', description: 'Fixed overlay covering entire viewport' },
                            { name: 'message', type: 'string', default: '(none)', description: 'Text shown below the spinner' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import PeanutLoading from '@/components/Global/PeanutLoading'`} />

                    <CodeBlock label="Usage" code={`{/* Inline */}
<PeanutLoading message="Loading your wallet..." />

{/* Full screen overlay */}
<PeanutLoading coverFullScreen message="Please wait..." />`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Use Loading (CSS spinner) inside buttons, inline indicators, and small containers. Use PeanutLoading for
                    page-level or section-level loading states where brand presence matters.
                </DesignNote>
                <DesignNote type="warning">
                    PeanutLoading with coverFullScreen renders a fixed z-50 overlay. Make sure to conditionally render it
                    only when loading is active to avoid blocking the UI.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
