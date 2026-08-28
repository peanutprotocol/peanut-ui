'use client'

import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
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
            {/* Hero — DS Card + TitleBlock on the brand fill */}
            <Card className="bg-action-primary p-6">
                <TitleBlock
                    size="m"
                    title={<h1 className="text-foreground-over-color-primary">Peanut Design System</h1>}
                    description={
                        <span className="text-foreground-over-color-secondary">
                            Foundations → Primitives → Patterns → Audit → Playground
                        </span>
                    }
                />
            </Card>

            {/* Quick stats — DS Cards (no dedicated stat-tile primitive) */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Inventoried', value: '428' },
                    { label: 'Flagged dead', value: '68' },
                    { label: 'Merge clusters', value: '104' },
                ].map((stat) => (
                    <Card key={stat.label} className="p-3 text-center">
                        <p className="text-heading-s font-bold">{stat.value}</p>
                        <p className="text-body-xs text-foreground-secondary">{stat.label}</p>
                    </Card>
                ))}
            </div>

            {/* Section index — DS ListItem rows (kept as solo cards: each row
                sits inside its own Link, so ListGroup can't position-cluster them) */}
            <div className="space-y-2">
                {sections.map((section) => (
                    <Link key={section.href} href={section.href} className="block">
                        <ListItem
                            className="cursor-pointer transition-colors duration-instant hover:bg-background-disabled"
                            leading={<IconBubble icon={section.icon} size="s" color="yellow" />}
                            title={
                                <span className="flex items-center gap-2">
                                    {section.title}
                                    <span className="rounded-round bg-background-disabled px-2 py-0.5 text-label-m text-foreground-secondary">
                                        {section.count}
                                    </span>
                                </span>
                            }
                            body={section.description}
                            chevron
                        />
                    </Link>
                ))}
            </div>

            {/* Design rules quick reference — DS Card */}
            <Card className="space-y-4 bg-background-page p-3">
                <p className="text-body-s font-bold">Quick Rules</p>
                <ul className="space-y-1 text-body-s text-foreground-secondary">
                    <li>
                        Primary CTA:{' '}
                        <code className="rounded-sm bg-background-default px-1 font-mono text-body-xs">
                            variant=&quot;purple&quot; shadowSize=&quot;4&quot; w-full
                        </code>
                    </li>
                    <li>
                        Links:{' '}
                        <code className="rounded-sm bg-background-default px-1 font-mono text-body-xs">
                            text-black underline
                        </code>{' '}
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
            </Card>
        </DocPage>
    )
}
