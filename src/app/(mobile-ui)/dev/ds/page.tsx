'use client'

import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { DocPage } from './_components/DocPage'

import { SIDEBAR_CONFIG } from './_components/nav-config'

// same guarded require as ds/audit/page.tsx — keeps the ~360KB audit inventory
// out of the prod bundle while letting the stats derive from the real data
const auditData =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional require IS the tree-shaking mechanism; import() would code-split the data into a chunk that still ships
          (require('./audit/audit-data') as typeof import('./audit/audit-data'))
        : null

const AUDIT_ITEMS = auditData?.AUDIT_ITEMS ?? []
const AUDIT_CLUSTERS = auditData?.AUDIT_CLUSTERS ?? []

const stats = [
    { label: 'Inventoried', value: String(AUDIT_ITEMS.length) },
    { label: 'Flagged dead', value: String(AUDIT_ITEMS.filter((i) => i.status === 'dead').length) },
    { label: 'Merge clusters', value: String(AUDIT_CLUSTERS.length) },
]

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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.label} className="p-3 text-center">
                        <p className="text-heading-s">{stat.value}</p>
                        <p className="text-body-xs text-foreground-secondary">{stat.label}</p>
                    </Card>
                ))}
            </div>

            {/* Section index — DS ListItem rows, position-clustered via getCardPosition
                (each row sits inside its own Link, so ListGroup can't do it) */}
            <div>
                {sections.map((section, i) => (
                    <Link key={section.href} href={section.href} className="block">
                        <ListItem
                            className="cursor-pointer transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                            position={getCardPosition(i, sections.length)}
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
                        'Use Button variant="primary" for primary actions. Its standard shadow is built in.',
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
