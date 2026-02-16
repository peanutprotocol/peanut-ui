'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Modal from '@/components/Global/Modal'
import ActionModal from '@/components/Global/ActionModal'
import { PropsTable } from '../../_components/PropsTable'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

export default function ModalPage() {
    const [showModal, setShowModal] = useState(false)
    const [showActionModal, setShowActionModal] = useState(false)
    const [actionCheckbox, setActionCheckbox] = useState(false)

    return (
        <DocPage>
            <DocHeader
                title="Modal"
                description="Base Modal for custom dialog content, and ActionModal for standardized confirmation/action dialogs with icon, title, description, CTAs, and optional checkbox."
                status="production"
            />

            {/* Base Modal */}
            <DocSection title="Base Modal">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        HeadlessUI Dialog wrapper with animated overlay and panel. Use for custom modal content.
                    </p>

                    <div>
                        <Button variant="stroke" onClick={() => setShowModal(true)}>
                            Open Base Modal
                        </Button>
                        <Modal visible={showModal} onClose={() => setShowModal(false)} title="Example Modal">
                            <div className="p-5">
                                <p className="text-sm text-grey-1">
                                    This is the base Modal. It provides the overlay, panel animation, close button, and
                                    optional title bar. You supply the children.
                                </p>
                                <div className="mt-4">
                                    <Button variant="purple" shadowSize="4" className="w-full" onClick={() => setShowModal(false)}>
                                        Got it
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'visible', type: 'boolean', default: '-', required: true, description: 'Controls modal visibility' },
                            { name: 'onClose', type: '() => void', default: '-', required: true, description: 'Called when overlay or close button clicked' },
                            { name: 'title', type: 'string', default: '(none)', description: 'Renders title bar with border' },
                            { name: 'className', type: 'string', default: "''", description: 'Class for the Dialog root' },
                            { name: 'classWrap', type: 'string', default: "''", description: 'Class for Dialog.Panel' },
                            { name: 'classOverlay', type: 'string', default: "''", description: 'Class for the backdrop overlay' },
                            { name: 'classButtonClose', type: 'string', default: "''", description: 'Class for the close button' },
                            { name: 'preventClose', type: 'boolean', default: 'false', description: 'Disables closing via overlay click' },
                            { name: 'hideOverlay', type: 'boolean', default: 'false', description: 'Hides close button and title, renders children directly' },
                            { name: 'video', type: 'boolean', default: 'false', description: 'Aspect-ratio video mode' },
                            { name: 'children', type: 'ReactNode', default: '-', required: true },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Modal from '@/components/Global/Modal'`} />

                    <CodeBlock label="Usage" code={`<Modal visible={visible} onClose={() => setVisible(false)} title="Example">
  <div className="p-5">
    {/* Your content */}
  </div>
</Modal>`} />
                </DocSection.Code>
            </DocSection>

            {/* ActionModal */}
            <DocSection title="ActionModal">
                <DocSection.Content>
                    <p className="text-sm text-grey-1">
                        Pre-composed modal with icon, title, description, CTA buttons, and optional checkbox. Built on top of
                        Base Modal.
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
                                    variant: 'purple',
                                    disabled: !actionCheckbox,
                                    onClick: () => {
                                        setShowActionModal(false)
                                        setActionCheckbox(false)
                                    },
                                },
                            ]}
                        />
                    </div>

                    <PropsTable
                        rows={[
                            { name: 'visible', type: 'boolean', default: '-', required: true },
                            { name: 'onClose', type: '() => void', default: '-', required: true },
                            { name: 'title', type: 'string | ReactNode', default: '-', required: true },
                            { name: 'description', type: 'string | ReactNode', default: '(none)', description: 'Subtitle text' },
                            { name: 'icon', type: 'IconName | ReactNode', default: '(none)', description: 'Displayed in pink circle above title' },
                            { name: 'iconProps', type: 'Partial<IconProps>', default: '(none)', description: 'Override icon size/color' },
                            { name: 'isLoadingIcon', type: 'boolean', default: 'false', description: 'Replace icon with spinner' },
                            { name: 'ctas', type: 'ActionModalButtonProps[]', default: '[]', description: 'Array of {text, variant, onClick, ...ButtonProps}' },
                            { name: 'checkbox', type: 'ActionModalCheckboxProps', default: '(none)', description: '{text, checked, onChange}' },
                            { name: 'preventClose', type: 'boolean', default: 'false', description: 'Block overlay-click dismiss' },
                            { name: 'hideModalCloseButton', type: 'boolean', default: 'false', description: 'Hides the X button' },
                            { name: 'content', type: 'ReactNode', default: '(none)', description: 'Custom content between description and CTAs' },
                            { name: 'footer', type: 'ReactNode', default: '(none)', description: 'Content below CTAs' },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import ActionModal from '@/components/Global/ActionModal'`} />

                    <CodeBlock label="Usage" code={`<ActionModal
  visible={visible}
  onClose={() => setVisible(false)}
  title="Confirm Action"
  description="Are you sure?"
  icon="alert"
  checkbox={{
    text: 'I understand',
    checked: checked,
    onChange: setChecked,
  }}
  ctas={[
    { text: 'Cancel', variant: 'stroke', onClick: handleCancel },
    { text: 'Confirm', variant: 'purple', onClick: handleConfirm },
  ]}
/>`} />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            {/* Design Notes */}
            <DocSection title="Design Rules">
                <DesignNote type="info">
                    ActionModal is the preferred pattern for confirmations and simple actions. Use Base Modal only when you
                    need fully custom content.
                </DesignNote>
                <DesignNote type="warning">
                    ActionModal icon renders in a pink (primary-1) circle by default. Override with iconContainerClassName
                    if needed.
                </DesignNote>
            </DocSection>

            {/* Specialized Modals Reference */}
            <DocSection title="Specialized Modals (14)">
                <p className="text-sm text-grey-1">
                    These are pre-built modals for specific flows. They compose ActionModal or Modal internally.
                </p>
                <div className="overflow-x-auto rounded-sm border border-n-1 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-n-1 bg-primary-3/20">
                                <th className="px-3 py-1.5 text-left font-bold">Component</th>
                                <th className="px-3 py-1.5 text-left font-bold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['InviteFriendsModal', 'Share referral link with copy + social buttons'],
                                ['ConfirmInviteModal', 'Confirm invitation before sending'],
                                ['GuestLoginModal', 'Prompt guest users to log in or register'],
                                ['KycVerifiedOrReviewModal', 'KYC verification status feedback'],
                                ['BalanceWarningModal', 'Warn about insufficient balance'],
                                ['TokenAndNetworkConfirmationModal', 'Confirm token + chain before transfer'],
                                ['TokenSelectorModal', 'Pick token from a list'],
                                ['ChainSelectorModal', 'Pick blockchain network'],
                                ['RecipientSelectorModal', 'Pick or enter recipient address'],
                                ['QRCodeModal', 'Display QR code for sharing'],
                                ['TransactionStatusModal', 'Show tx pending/success/failed state'],
                                ['WalletConnectModal', 'Wallet connection flow'],
                                ['ExportPrivateKeyModal', 'Reveal and copy private key'],
                                ['ConfirmTransactionModal', 'Final review before transaction submit'],
                            ].map(([name, purpose]) => (
                                <tr key={name} className="border-b border-n-1 last:border-0">
                                    <td className="px-3 py-1.5 font-mono font-bold">{name}</td>
                                    <td className="px-3 py-1.5">{purpose}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>
        </DocPage>
    )
}
