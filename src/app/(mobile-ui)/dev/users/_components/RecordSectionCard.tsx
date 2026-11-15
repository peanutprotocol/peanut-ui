import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { twMerge } from '@/utils/tw'
import type { RecordSection } from '../userRecords.types'
import { linkDescription, rowCountLabel, sectionAnchor } from '../userRecords.utils'
import RecordFields from './RecordFields'
import RecordTable from './RecordTable'

export default function RecordSectionCard({ section }: { section: RecordSection }) {
    return (
        <section id={sectionAnchor(section.table)} className={twMerge(CARD_SURFACE, 'scroll-mt-20 overflow-hidden')}>
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-default px-4 py-3">
                <h2 className="font-mono text-body-s-semibold">{section.table}</h2>
                <span className="text-body-xs text-foreground-secondary">{rowCountLabel(section)}</span>
                <span
                    className="ml-auto font-mono text-body-xs text-foreground-secondary"
                    title="How this table links to the user"
                >
                    via {linkDescription(section)}
                </span>
            </header>
            {section.error ? (
                <div className="p-4">
                    <Callout priority="error">Could not read this table: {section.error}</Callout>
                </div>
            ) : section.rows.length === 1 ? (
                <RecordFields columns={section.columns} row={section.rows[0]} />
            ) : (
                <RecordTable section={section} />
            )}
        </section>
    )
}
