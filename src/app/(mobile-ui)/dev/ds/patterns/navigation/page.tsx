'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function NavigationPage() {
    const [flowStep, setFlowStep] = useState(1)

    return (
        <DocPage>
            <DocHeader
                title="Navigation"
                description="NavHeader for page-level navigation — back button, optional title, optional trailing element (board navigation.top.*)."
                status="production"
            />

            {/* NavHeader */}
            <DocSection title="NavHeader">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Top navigation bar with back button (link or callback), centered title, and optional logout
                        button. Uses authContext for logout.
                    </p>

                    <DesignNote type="warning">
                        NavHeader uses useAuth() internally for the logout button. It cannot be rendered in isolation
                        outside of the auth provider. Showing code examples only.
                    </DesignNote>

                    <PropsTable
                        rows={[
                            { name: 'title', type: 'string', default: '(none)', description: 'Centered title text' },
                            {
                                name: 'href',
                                type: 'string',
                                default: "'/home'",
                                description: 'Link destination when no onPrev',
                            },
                            {
                                name: 'onPrev',
                                type: '() => void',
                                default: '(none)',
                                description: 'Callback replaces Link with Button',
                            },
                            {
                                name: 'icon',
                                type: 'IconName',
                                default: "'chevron-up'",
                                description: 'Back button icon (rotated -90deg)',
                            },
                            {
                                name: 'disableBackBtn',
                                type: 'boolean',
                                default: 'false',
                                description: 'Disables the back button',
                            },
                            {
                                name: 'showLogoutBtn',
                                type: 'boolean',
                                default: 'false',
                                description: 'Shows logout icon button on right',
                            },
                            {
                                name: 'hideLabel',
                                type: 'boolean',
                                default: 'false',
                                description: 'Hides the title text',
                            },
                            {
                                name: 'titleClassName',
                                type: 'string',
                                default: "''",
                                description: 'Override title styles',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import NavHeader from '@/components/Global/NavHeader'`} />

                    <CodeBlock label="Link-based (default)" code={`<NavHeader title="Settings" href="/home" />`} />

                    <CodeBlock
                        label="Callback-based"
                        code={`<NavHeader title="Edit Profile" onPrev={() => router.back()} />`}
                    />

                    <CodeBlock label="With logout" code={`<NavHeader title="Account" showLogoutBtn />`} />
                </DocSection.Code>
            </DocSection>

            {/* Flow usage (hideLabel + rightElement) */}
            <DocSection title="Flow Usage (hideLabel + rightElement)">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Minimal header for multi-step flows. Back button on the left, optional element on the right. No
                        title -- the screen content below provides context.
                    </p>

                    {/* Live demo */}
                    <div className="space-y-2 rounded-sm border border-n-1 p-3">
                        <p className="text-xs font-bold tracking-wider text-grey-1 uppercase">
                            Live Demo (step {flowStep}/3)
                        </p>
                        <NavHeader
                            hideLabel
                            onPrev={() => setFlowStep((s) => Math.max(1, s - 1))}
                            disableBackBtn={flowStep <= 1}
                            rightElement={<span className="text-xs text-grey-1">{flowStep}/3</span>}
                        />
                        <div className="flex items-center justify-center rounded-sm bg-primary-3/20 py-8">
                            <span className="text-sm font-bold">Step {flowStep} Content</span>
                        </div>
                        {flowStep < 3 ? (
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                onClick={() => setFlowStep((s) => s + 1)}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button variant="purple" shadowSize="4" className="w-full" onClick={() => setFlowStep(1)}>
                                Restart
                            </Button>
                        )}
                    </div>

                    <PropsTable
                        rows={[
                            {
                                name: 'onPrev',
                                type: '() => void',
                                default: '(none)',
                                description: 'Back button handler. If omitted, no back button shown.',
                            },
                            {
                                name: 'disableBackBtn',
                                type: 'boolean',
                                default: 'false',
                                description: 'Grays out the back button',
                            },
                            {
                                name: 'rightElement',
                                type: 'ReactNode',
                                default: '(none)',
                                description: 'Element rendered on the right (e.g. step indicator)',
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`<NavHeader
  hideLabel
  onPrev={() => setStep((s) => Math.max(1, s - 1))}
  disableBackBtn={step <= 1}
  rightElement={<span className="text-xs text-grey-1">2/3</span>}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    NavHeader is the one top-nav header: title mode for standalone pages (Settings, Profile), hideLabel
                    + rightElement mode for multi-step wizards (Send, Request, Claim). FlowHeader was folded into it.
                </DesignNote>
                <DesignNote type="info">
                    The back arrow is a 40px circle button with a 44px hit area (board navigation.top.*) — the standard
                    navigation button size.
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
