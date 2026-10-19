import { ViewportFrame } from '@/app/dev/ds-marketing-preview/_components/ViewportFrame'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { CONTENT_DEMOS } from './content-data'

export default function MarketingContentPage() {
    return (
        <DocPage>
            <DocHeader
                title="Content pages"
                description="The chrome every content page gets: hero, FAQ, tables, gutter, page header. One rule per piece."
            />

            <DesignNote type="info">
                This page is how things look. What goes on a content page, in which order and with which copy:
                content/_system/guidelines/components.md. Toggle Phone 390 / Desktop 1440 on each frame.
            </DesignNote>

            {CONTENT_DEMOS.map((entry) => (
                <DocSection key={entry.demo} title={entry.title} description={entry.rule}>
                    <DocSection.Content>
                        <ViewportFrame demo={entry.demo} label={entry.title} heights={entry.heights} />
                    </DocSection.Content>
                    {entry.code && (
                        <DocSection.Code>
                            <CodeBlock label="mdx" code={entry.code} />
                        </DocSection.Code>
                    )}
                </DocSection>
            ))}
        </DocPage>
    )
}
