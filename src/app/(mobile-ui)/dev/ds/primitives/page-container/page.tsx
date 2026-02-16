'use client'

import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function PageContainerPage() {
    return (
        <DocPage>
            <DocHeader title="PageContainer" description="Responsive page wrapper with max-width centering. On desktop, applies left padding for sidebar offset." status="production" />

            <SectionDivider />

            <PropsTable rows={[
                { name: 'alignItems', type: "'start' | 'center'", default: "'start'" },
            ]} />

            <DocSection title="Usage">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Wraps mobile screens with responsive width constraints. Children inherit full width via the <code className="font-mono">*:w-full</code> selector. On desktop (md+), content is offset with <code className="font-mono">md:pl-24</code> and capped at <code className="font-mono">md:*:max-w-xl</code>.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import PageContainer from '@/components/0_Bruddle/PageContainer'`}
                    />
                    <CodeBlock
                        label="Usage"
                        code={`<PageContainer>
  <div className="flex min-h-[inherit] flex-col gap-8">
    <NavHeader title="Title" />
    <div className="my-auto flex flex-col gap-6">
      {/* content */}
    </div>
  </div>
</PageContainer>`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
