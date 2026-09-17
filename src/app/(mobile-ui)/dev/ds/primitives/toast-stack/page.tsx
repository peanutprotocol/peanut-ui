'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { PropsTable } from '../../_components/PropsTable'
import { SectionDivider } from '../../_components/SectionDivider'

export default function ToastStackPage() {
    return (
        <DocPage>
            <DocHeader
                title="ToastStack"
                description="The toast provider's render surface, split out so framer-motion stays out of the initial bundle. Product code never renders it — ToastProvider owns it; fire toasts via useToast()."
                status="production"
            />

            <SectionDivider />

            <PropsTable
                rows={[
                    { name: 'toasts', type: 'ToastMessage[]', default: '(required)' },
                    { name: 'dismiss', type: '(id) => void', default: '(required)' },
                    {
                        name: 'onShow',
                        type: '(id) => void',
                        default: '(none)',
                        description: 'Fired per toast once it is on screen',
                    },
                ]}
            />

            <DocSection
                title="Usage"
                description="Never render ToastStack yourself. Call useToast() and the provider mounts the stack on demand. Tones, auto-dismiss timing, and a live demo are on the Toast page."
            >
                <DocSection.Content>
                    <LinkButton href="/dev/ds/primitives/toast">Toast — tones, timing, live demo</LinkButton>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import ToastStack from '@/components/0_Bruddle/ToastStack'`} />
                    <CodeBlock label="Product code" code={`const toast = useToast()\ntoast.success('Saved')`} />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
