'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { PropsTable } from '../../_components/PropsTable'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ToastPage() {
    const { success, error, info, warning } = useToast()

    return (
        <DocPage>
            <DocHeader title="Toast" description="Context-based toast notification system. 4 types, auto-dismiss, clean API." status="production" />

            <DocSection title="Interactive Demo" description="Tap each button to trigger a toast notification.">
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="stroke" size="small" onClick={() => success('Operation successful!')}>success</Button>
                        <Button variant="stroke" size="small" onClick={() => error('Something went wrong')}>error</Button>
                        <Button variant="stroke" size="small" onClick={() => info('Did you know?')}>info</Button>
                        <Button variant="stroke" size="small" onClick={() => warning('Check this out')}>warning</Button>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Import"
                        code={`import { useToast } from '@/components/0_Bruddle/Toast'`}
                    />
                    <CodeBlock
                        label="Hook Usage"
                        code={`const { success, error, info, warning } = useToast()`}
                    />
                    <CodeBlock
                        label="Trigger Toasts"
                        code={`success('Done!')
error('Failed!')
info('FYI...')
warning('Be careful!')`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable rows={[
                { name: 'message', type: 'string', default: '(required)', required: true, description: 'Toast message text' },
                { name: 'type', type: "'success' | 'error' | 'info' | 'warning'", default: '(method)', description: 'Determined by which method you call' },
                { name: 'duration', type: 'number', default: '3000', description: 'Auto-dismiss duration in ms' },
            ]} />
        </DocPage>
    )
}
