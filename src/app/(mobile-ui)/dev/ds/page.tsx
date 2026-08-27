'use client'

import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'
import { Card } from '@/components/0_Bruddle/Card'
import { DocPage } from './_components/DocPage'

import { SIDEBAR_CONFIG } from './_components/nav-config'

const sections = [
    {
        title: 'Foundations',
        description: 'Color tokens, typography, spacing, shadows, icons, and borders',
        href: '/dev/ds/foundations',
        icon: 'bulb' as const,
        count: SIDEBAR_CONFIG.foundations.length,
    },
    {
        title: 'Primitives',
        description: 'Bruddle base components: Button, Card, Input, Select, Checkbox, Toast',
        href: '/dev/ds/primitives',
        icon: 'switch' as const,
        count: SIDEBAR_CONFIG.primitives.length,
    },
    {
        title: 'Patterns',
        description: 'Composed components: Modal, Drawer, Navigation, Loading, Feedback, Layouts',
        href: '/dev/ds/patterns',
        icon: 'docs' as const,
        count: SIDEBAR_CONFIG.patterns.length,
    },
    {
        title: 'Audit',
        description:
            'Three lenses: Code Audit (DRY consolidation) · App Divergences (live vs showcase-only vs dead in product) · Big Components (modals, drawers, lists)',
        href: '/dev/ds/audit',
        icon: 'search' as const,
        count: SIDEBAR_CONFIG.audit.length,
    },
    {
        title: 'Playground',
        description: 'Interactive test harnesses: shake & confetti, perk success, share-asset builder',
        href: '/dev/ds/playground',
        icon: 'bulb' as const,
        count: SIDEBAR_CONFIG.playground.length,
    },
]

export default function DesignSystemPage() {
    return (
        <DocPage>
            {/* Hero */}
            <div className="rounded-sm border border-border-default bg-action-primary p-6">
                <h1 className="text-heading-l text-foreground-over-color-primary">Peanut Design System</h1>
                <p className="mt-1 text-body-s text-foreground-over-color-secondary">
                    Foundations → Primitives → Patterns → Audit → Playground
                </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Inventoried', value: '428' },
                    { label: 'Flagged dead', value: '68' },
                    { label: 'Merge clusters', value: '104' },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-sm border border-border-default p-3 text-center">
                        <p className="text-heading-s font-bold">{stat.value}</p>
                        <p className="text-body-xs text-foreground-secondary">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Section cards */}
            <div className="space-y-4">
                {sections.map((section) => (
                    <Link key={section.href} href={section.href}>
                        <Card
                            shadowSize="4"
                            className="cursor-pointer p-4 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-sm border border-border-default bg-background-badge-accent">
                                    <Icon name={section.icon} size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-body-m font-bold">{section.title}</h3>
                                        <span className="rounded-full bg-background-disabled px-2 py-0.5 text-body-xs font-bold text-foreground-secondary">
                                            {section.count}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-body-s text-foreground-secondary">
                                        {section.description}
                                    </p>
                                </div>
                                <Icon name="arrow-up-right" size={16} className="text-foreground-secondary" />
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Design rules quick reference */}
            <div className="space-y-4 rounded-sm border border-border-default bg-background-page p-3">
                <p className="text-body-s font-bold">Quick Rules</p>
                <ul className="space-y-1 text-body-s text-foreground-secondary">
                    <li>
                        Primary CTA:{' '}
                        <code className="rounded bg-white px-1 font-mono text-[10px]">
                            variant=&quot;purple&quot; shadowSize=&quot;4&quot; w-full
                        </code>
                    </li>
                    <li>
                        Links: <code className="rounded bg-white px-1 font-mono text-[10px]">text-black underline</code>{' '}
                        — never text-purple-1
                    </li>
                    <li>
                        purple-1 is <span className="inline-block size-3 rounded-sm bg-purple-1 align-middle" /> pink
                        (#FF90E8), not purple
                    </li>
                    <li>size=&quot;large&quot; is h-10 (shorter than default h-13)</li>
                    <li>
                        Card deposits: say &quot;starter balance&quot; — never &quot;card balance&quot; or &quot;Peanut
                        rewards&quot;
                    </li>
                </ul>
            </div>
        </DocPage>
    )
}
