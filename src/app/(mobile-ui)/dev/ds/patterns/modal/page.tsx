'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import ActionModal, { type ActionModalTone } from '@/components/Global/ActionModal'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { ProductUsage } from '../../_components/ProductUsage'

const TONES: ActionModalTone[] = ['error', 'attention', 'success', 'info', 'peanut']

export default function ModalPage() {
    const [showActionModal, setShowActionModal] = useState(false)
    const [actionCheckbox, setActionCheckbox] = useState(false)
    const [toneModal, setToneModal] = useState<ActionModalTone | null>(null)
    // product recreations open on demand — an auto-opened overlay would cover the page
    const [bridgeTosModal, setBridgeTosModal] = useState(false)
    const [lockCardModal, setLockCardModal] = useState(false)

    return (
        <DocPage>
            <DocHeader
                title="ActionModal"
                description="Standard confirmation and action dialog with an icon, title, description, CTAs, and optional checkbox."
                status="production"
            />

            <WhenToUse
                use={[
                    'A decision the user answers: confirm, cancel, or a destructive action.',
                    'One short message plus its CTAs, when the content must fully catch attention.',
                    'Destructive confirms: red icon bubble, primary confirm, tertiary cancel link.',
                    'Every modal in the app — route it through ActionModal, never Global/Modal directly.',
                ]}
                dontUse={[
                    'Content you browse — a detail view, a selection list, anything that scrolls. → use a Drawer.',
                    'A decision raised from inside an open drawer — the modal opens behind the drawer overlay. → use a nested Drawer.',
                    'A purely informational surface — every modal offers at least one action button.',
                ]}
            />

            {/* ActionModal */}
            <DocSection title="ActionModal">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        Pre-composed modal with icon, title, description, CTA buttons, and optional checkbox.
                    </p>

                    <div>
                        <Button variant="secondary" onClick={() => setShowActionModal(true)}>
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
                            tone="attention"
                            icon="alert"
                            checkbox={{
                                text: 'I understand the consequences',
                                checked: actionCheckbox,
                                onChange: setActionCheckbox,
                            }}
                            ctas={[
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
                            tertiaryCta={{
                                text: 'Cancel',
                                onClick: () => {
                                    setShowActionModal(false)
                                    setActionCheckbox(false)
                                },
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-body-s text-foreground-secondary">
                            <code>tone</code> picks the bubble color and a default icon: error (red, ban), attention
                            (yellow, alert), success (green, check), info (blue, info), peanut (yellow, no default: name
                            the Peanut thing). A product concept passes <code>concept</code> and takes its CONCEPT_ICONS
                            pair (QR pay pink, card yellow, bank blue). An explicit <code>icon</code> still wins over a
                            tone. An icon without a tone or a concept does not compile.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TONES.map((tone) => (
                                <Button key={tone} variant="secondary" size="small" onClick={() => setToneModal(tone)}>
                                    tone=&quot;{tone}&quot;
                                </Button>
                            ))}
                        </div>
                        <ActionModal
                            visible={toneModal !== null}
                            onClose={() => setToneModal(null)}
                            tone={toneModal ?? 'info'}
                            icon={toneModal === 'peanut' ? 'bell' : undefined}
                            title={`tone="${toneModal ?? 'info'}"`}
                            description="Icon and bubble color come from the tone, not from a class name."
                            ctas={[{ text: 'Close', variant: 'primary', onClick: () => setToneModal(null) }]}
                        />
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'visible', type: 'boolean', default: '-', required: true },
                            { name: 'onClose', type: '() => void', default: '-', required: true },
                            { name: 'title', type: 'string | ReactNode', default: '-', required: true },
                            {
                                name: 'tone',
                                type: "'error' | 'attention' | 'success' | 'info' | 'peanut'",
                                default: '(none)',
                                description: 'Semantic bubble color + default icon. Required whenever an icon renders',
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
                                name: 'tertiaryCta',
                                type: 'ActionModalTertiaryCta',
                                default: '(none)',
                                description:
                                    '{text, onClick?, href?, disabled?}: the underlined LinkButton under the ctas. Every cancel, not now, skip or keep goes here',
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
  tone="attention"
  checkbox={{
    text: 'I understand',
    checked: checked,
    onChange: setChecked,
  }}
  ctas={[{ text: 'Confirm', variant: 'primary', onClick: handleConfirm }]}
  tertiaryCta={{ text: 'Cancel', onClick: handleCancel }}
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
                    Cancel, not now, do this later, skip, keep and close are never a Button next to the primary. They go
                    in <code>tertiaryCta</code>, the underlined link 24px under the ctas. A secondary Button is only for
                    a second path of equal weight.
                </DesignNote>
                <DesignNote type="warning">
                    Every icon takes a <code>tone</code> or a <code>concept</code>: red for errors, green for success,
                    blue for plain information, yellow for attention and for Peanut&apos;s own. A concept keeps its
                    CONCEPT_ICONS color, so QR pay is pink here too. There is no implicit color; never recolor the
                    bubble with iconContainerClassName.
                </DesignNote>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="KYC — Bridge terms of service"
                    path="src/components/Kyc/BridgeTosStep.tsx"
                    description="One full-width primary with the defer action as the tertiary link, and the same modal carries the error state: icon, title and description all swap when the accept call fails."
                    code={`<ActionModal
  visible={visible && !showIframe && !isConfirming}
  onClose={onSkip}
  tone={error ? 'error' : 'info'}
  icon={error ? 'alert' : 'badge'}
  title={error ? t('bridgeTos.errorTitle') : copy.title}
  description={error || copy.description}
  ctas={[
    {
      text: t('bridgeTos.acceptTerms'),
      onClick: handleAcceptTerms,
      variant: 'primary',
      className: 'w-full',
      shadowSize: '4',
    },
  ]}
  tertiaryCta={{ text: t('bridgeTos.notNow'), onClick: onSkip }}
/>`}
                >
                    <Button variant="secondary" size="small" onClick={() => setBridgeTosModal(true)}>
                        Open example
                    </Button>
                    <ActionModal
                        visible={bridgeTosModal}
                        onClose={() => setBridgeTosModal(false)}
                        tone="info"
                        icon="badge"
                        title="Accept Bridge terms"
                        description="Bridge is our banking partner. Accept their terms to finish verification."
                        ctas={[
                            {
                                text: 'Accept terms',
                                onClick: () => setBridgeTosModal(false),
                                variant: 'primary',
                                className: 'w-full',
                                shadowSize: '4',
                            },
                        ]}
                        tertiaryCta={{ text: 'Not now', onClick: () => setBridgeTosModal(false) }}
                    />
                </ProductUsage.Example>

                <ProductUsage.Example
                    title="Card — lock the card"
                    path="src/components/Card/LockCardModal.tsx"
                    description="tone=attention with an explicit lock icon, and preventClose while the call runs so the modal cannot be dismissed mid-request."
                    code={`<ActionModal
  visible={isOpen}
  onClose={onClose}
  preventClose={phase === 'loading'}
  hideModalCloseButton={phase === 'loading'}
  tone="attention"
  icon="lock"
  title={t(copyKeys.title)}
  description={t(copyKeys.body)}
  content={hasBody ? bodyContent : undefined}
  tertiaryCta={{ text: tCommon('cancel'), onClick: onClose, disabled: phase === 'loading' }}
/>`}
                >
                    <Button variant="secondary" size="small" onClick={() => setLockCardModal(true)}>
                        Open example
                    </Button>
                    <ActionModal
                        visible={lockCardModal}
                        onClose={() => setLockCardModal(false)}
                        tone="attention"
                        icon="lock"
                        title="Lock your card?"
                        description="Payments stop straight away. You can unlock the card at any time."
                        ctas={[{ text: 'Lock card', variant: 'primary', onClick: () => setLockCardModal(false) }]}
                        tertiaryCta={{ text: 'Cancel', onClick: () => setLockCardModal(false) }}
                    />
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
