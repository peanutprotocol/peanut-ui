'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import ActionModal, { type ActionModalTone } from '@/components/Global/ActionModal'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

const TONES: ActionModalTone[] = ['error', 'warning', 'success', 'info']

export default function ModalPage() {
    const [showActionModal, setShowActionModal] = useState(false)
    const [actionCheckbox, setActionCheckbox] = useState(false)
    const [toneModal, setToneModal] = useState<ActionModalTone | null>(null)

    return (
        <DocPage>
            <DocHeader
                title="ActionModal"
                description="Standard confirmation and action dialog with an icon, title, description, CTAs, and optional checkbox."
                status="production"
            />

            {/* ActionModal */}
            <DocSection title="ActionModal">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Pre-composed modal with icon, title, description, CTA buttons, and optional checkbox.
                    </p>

                    <div>
                        <Button variant="stroke" onClick={() => setShowActionModal(true)}>
                            Open ActionModal
                        </Button>
                        <ActionModal
                            visible={showActionModal}
                            onClose={() => {
                                setShowActionModal(false)
                                setActionCheckbox(false)
                            }}
                            title="Confirm Action"
                            description="Are you sure you want to proceed? This action cannot be undone."
                            icon="alert"
                            checkbox={{
                                text: 'I understand the consequences',
                                checked: actionCheckbox,
                                onChange: setActionCheckbox,
                            }}
                            ctas={[
                                {
                                    text: 'Cancel',
                                    variant: 'stroke',
                                    onClick: () => {
                                        setShowActionModal(false)
                                        setActionCheckbox(false)
                                    },
                                },
                                {
                                    text: 'Confirm',
                                    variant: 'primary',
                                    disabled: !actionCheckbox,
                                    onClick: () => {
                                        setShowActionModal(false)
                                        setActionCheckbox(false)
                                    },
                                },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-body-s text-foreground-secondary">
                            <code>tone</code> picks the bubble color and a default icon: error (red, ban), warning
                            (yellow, alert), success (green, check), info (blue, info). An explicit <code>icon</code> or{' '}
                            <code>iconContainerClassName</code> still wins.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TONES.map((tone) => (
                                <Button key={tone} variant="stroke" size="small" onClick={() => setToneModal(tone)}>
                                    tone=&quot;{tone}&quot;
                                </Button>
                            ))}
                        </div>
                        <ActionModal
                            visible={toneModal !== null}
                            onClose={() => setToneModal(null)}
                            tone={toneModal ?? 'info'}
                            title={`tone="${toneModal ?? 'info'}"`}
                            description="Icon and bubble color come from the tone, not from a class name."
                            ctas={[{ text: 'Close', variant: 'stroke', onClick: () => setToneModal(null) }]}
                        />
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'visible', type: 'boolean', default: '-', required: true },
                            { name: 'onClose', type: '() => void', default: '-', required: true },
                            { name: 'title', type: 'string | ReactNode', default: '-', required: true },
                            {
                                name: 'tone',
                                type: "'error' | 'warning' | 'success' | 'info'",
                                default: '(none)',
                                description: 'Semantic bubble color + default icon',
                            },
                            {
                                name: 'description',
                                type: 'string | ReactNode',
                                default: '(none)',
                                description: 'Subtitle text',
                            },
                            {
                                name: 'icon',
                                type: 'IconName | ReactNode',
                                default: '(tone icon)',
                                description: 'Displayed in the bubble above the title',
                            },
                            {
                                name: 'iconProps',
                                type: 'Partial<IconProps>',
                                default: '(none)',
                                description: 'Override icon size/color',
                            },
                            {
                                name: 'isLoadingIcon',
                                type: 'boolean',
                                default: 'false',
                                description: 'Replace icon with spinner',
                            },
                            {
                                name: 'ctas',
                                type: 'ActionModalButtonProps[]',
                                default: '[]',
                                description: 'Array of {text, variant, onClick, ...ButtonProps}',
                            },
                            {
                                name: 'checkbox',
                                type: 'ActionModalCheckboxProps',
                                default: '(none)',
                                description: '{text, checked, onChange}',
                            },
                            {
                                name: 'preventClose',
                                type: 'boolean',
                                default: 'false',
                                description: 'Block overlay-click dismiss',
                            },
                            {
                                name: 'hideModalCloseButton',
                                type: 'boolean',
                                default: 'false',
                                description: 'Hides the X button',
                            },
                            {
                                name: 'content',
                                type: 'ReactNode',
                                default: '(none)',
                                description: 'Custom content between description and CTAs',
                            },
                            { name: 'footer', type: 'ReactNode', default: '(none)', description: 'Content below CTAs' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import ActionModal from '@/components/Global/ActionModal'`} />

                    <CodeBlock
                        label="Usage"
                        code={`<ActionModal
  visible={visible}
  onClose={() => setVisible(false)}
  title="Confirm Action"
  description="Are you sure?"
  tone="warning"
  checkbox={{
    text: 'I understand',
    checked: checked,
    onChange: setChecked,
  }}
  ctas={[
    { text: 'Cancel', variant: 'stroke', onClick: handleCancel },
    { text: 'Confirm', variant: 'primary', onClick: handleConfirm },
  ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    Use ActionModal for confirmations and simple actions. Flag a custom-dialog need before using an
                    undocumented modal shell.
                </DesignNote>
                <DesignNote type="warning">
                    Prefer <code>tone</code> over iconContainerClassName: yellow is for warnings only, red for errors,
                    green for success, blue for plain information. Without a tone the bubble is pink (primary-1).
                </DesignNote>
            </DocSection>
        </DocPage>
    )
}
