'use client'

import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'

export default function CloudsBackgroundPage() {
    return (
        <DocPage>
            <DocHeader
                title="CloudsBackground"
                description="Decorative drifting-clouds backdrop for success and marketing moments. Code-only (brand) — no figma board. Decoration only, never a functional screen."
                status="production"
            />

            <WhenToUse
                use={[
                    'Brand decoration behind an onboarding or invites hero',
                    'Pass minimal — both product call sites use it; the denser default has none today',
                    'Host it in a relative, overflow-hidden box that has a height of its own',
                    'Keep the illustration and the copy above it, on z-10',
                ]}
                dontUse={[
                    'The app background on a functional screen — use bg-peanut-repeat-normal',
                    'A loading or an empty state — use Loading or EmptyState',
                    'Anything that carries meaning — the clouds are decoration; put the message in the page copy',
                ]}
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'minimal',
                        type: 'boolean',
                        default: 'false',
                        description: 'Fewer, larger clouds — the quieter variant',
                    },
                ]}
            />

            <DocSection
                title="Examples"
                description="The component fills its nearest positioned ancestor, so it needs a relative overflow-hidden host with a size of its own."
            >
                <DocSection.Content>
                    <div className="space-y-6">
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Default</p>
                            <div className="relative h-64 overflow-hidden rounded-sm border border-border-disabled bg-background-page">
                                <CloudsBackground />
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-body-s text-foreground-secondary">Minimal</p>
                            <div className="relative h-64 overflow-hidden rounded-sm border border-border-disabled bg-background-page">
                                <CloudsBackground minimal />
                            </div>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<div className="relative h-64 overflow-hidden">\n    <CloudsBackground />\n</div>`}
                    />
                    <CodeBlock label="Minimal" code={`<CloudsBackground minimal />`} />
                </DocSection.Code>
            </DocSection>

            <ProductUsage>
                {/* boxed: in product the host fills the screen's decoration band, which would blow up the doc layout */}
                <ProductUsage.Example
                    title="Invites — page hero"
                    path="src/components/Invites/InvitesPageLayout.tsx"
                    description="Same treatment on the invites hero, behind the mascot (or the draggable peanut on the jail step)."
                    code={`{/* animated clouds background */}
<CloudsBackground minimal />
{/* main illustration — draggable peanut on the jail step, Lottie otherwise */}
{showRagdoll && PeanutRagdoll ? <PeanutRagdoll /> : <PeanutMascot pose={pose} … />}`}
                >
                    <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-sm border border-border-disabled bg-background-page">
                        <CloudsBackground minimal />
                        <div className="relative z-10 flex size-24 items-center justify-center rounded-sm border border-dashed border-border-default text-body-xs text-foreground-secondary">
                            mascot
                        </div>
                    </div>
                </ProductUsage.Example>

                <p className="text-body-s text-foreground-secondary">
                    The call site passes <code>minimal</code>. The default (denser) variant has no product call site
                    today — it only appears on this page.
                </p>
            </ProductUsage>
        </DocPage>
    )
}
