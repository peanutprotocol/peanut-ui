'use client'

import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { BulletList } from '@/components/0_Bruddle/BulletList'
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
                        <p className="text-heading-s">{stat.value}</p>
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
                            className="cursor-pointer transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                            leading={<IconBubble icon={section.icon} size="s" color="yellow" />}
                            title={
                                <span className="flex items-center gap-2">
                                    {section.title}
                                    <span className="text-label-m text-foreground-secondary">{section.count}</span>
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
                <p className="text-body-m-semibold">Quick rules</p>
                <BulletList
                    items={[
                        'Use Button variant="purple" for primary actions. Its standard shadow is built in.',
                        'Use LinkButton for standalone links. Underline links that sit inside a sentence.',
                        'Use semantic color tokens in new UI. Legacy palette names remain migration-only.',
                        'Button sizes are large 48px, medium 44px, and small 40px with a 44px hit area.',
                        'Use PageContainer for the centered app column and PageStack for page rhythm.',
                    ]}
                />
            </Card>
        </DocPage>
    )
}
