'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import InfoCard from '@/components/Global/InfoCard'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type FaqModal = 'lose-phone' | 'change-phone' | 'export-keys' | null

export default function BackupPage() {
    const router = useRouter()
    const { deviceType } = useDeviceType()
    const [activeModal, setActiveModal] = useState<FaqModal>(null)

    const isAndroid = deviceType === 'android'
    const accountType = isAndroid ? 'Google account' : 'Apple ID'

    const backupSteps = isAndroid
        ? [
              { title: 'Open Settings', description: 'Google → All services' },
              { title: 'Find Password Manager', description: 'Autofill → Google Password Manager → Turn ON sync' },
              { title: 'Verify in Chrome', description: 'Settings → Passwords → Search "Peanut"' },
          ]
        : [
              { title: 'Go to Settings', description: '[Your Name] → iCloud' },
              { title: 'Find Passwords & Keychain', description: 'Turn it on' },
              { title: 'Verify it worked', description: 'Settings → Passwords → Search "Peanut"' },
          ]

    const closeModal = () => setActiveModal(null)

    return (
        <PageContainer>
            <div className="mb-6 space-y-8">
                <NavHeader title="Backup" onPrev={() => router.replace('/profile')} />

                <EmptyState
                    title="Self-custody wallet"
                    description="Only you control this wallet. We can't recover it if you lose access. Your backup is your responsibility."
                    icon="upload-cloud"
                />

                <div className="space-y-2">
                    <h1 className="font-bold text-black">Enable backup now</h1>
                    <Card>
                        <ol className="list-decimal space-y-4 py-2 pl-5">
                            {backupSteps.map((step, index) => (
                                <li key={index}>
                                    <p className="font-bold text-black">{step.title}</p>
                                    <p className="text-sm text-black">{step.description}</p>
                                </li>
                            ))}
                        </ol>
                    </Card>
                </div>

                <InfoCard
                    variant="warning"
                    title="No backup = No recovery"
                    description="If you lose your phone without backup enabled, your money is gone forever."
                    icon="alert"
                />

                <div>
                    <h1 className="mb-2 font-bold text-black">Common questions</h1>
                    <Card position="first" onClick={() => setActiveModal('lose-phone')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">What if I lose my phone?</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                    <Card position="middle" onClick={() => setActiveModal('change-phone')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">What if I change phone?</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                    <Card position="last" onClick={() => setActiveModal('export-keys')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">Why can't I export my private key?</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                </div>
            </div>

            {/* FAQ Modal: What if I lose my phone? */}
            <ActionModal
                visible={activeModal === 'lose-phone'}
                onClose={closeModal}
                icon="info"
                title="What if I lose my phone?"
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-3">
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title="Backup is enabled"
                            description={`Sign into your new phone with your ${accountType}. Download Peanut. Your wallet restores automatically`}
                        />
                        <InfoCard
                            variant="error"
                            icon="cancel"
                            title="No backup"
                            description="Your funds are permanently lost, we can't recover your wallet. This is how self-custody works."
                        />
                    </div>
                }
            />

            {/* FAQ Modal: What if I change phone? */}
            <ActionModal
                visible={activeModal === 'change-phone'}
                onClose={closeModal}
                icon="info"
                title="What if I change phone?"
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-3">
                        <ol className="list-decimal pl-5 text-left text-sm text-black">
                            <li>Verify backup is working (check step 3 above)</li>
                            <li>Know your {accountType} password</li>
                            <li>Keep old phone until new one works</li>
                        </ol>
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title="iPhone → iPhone"
                            description="Just sign in. Everything transfers."
                        />
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title="Android → Android"
                            description="Sign into Google. Your wallet follows."
                        />
                        <InfoCard
                            variant="warning"
                            icon="alert"
                            title="iPhone ↔ Android"
                            description="Create new wallet on new device. Transfer your funds. Passkeys don't work cross-platform unless you are using a third party password manager such as 1Password. "
                        />
                    </div>
                }
            />

            {/* FAQ Modal: Why can't I export my private key? */}
            <ActionModal
                visible={activeModal === 'export-keys'}
                onClose={closeModal}
                icon="info"
                title="Why can't I export my private key?"
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-4 text-left">
                        <div>
                            <h4 className="font-bold text-black">Passkeys are safer by design</h4>
                            <p className="mt-1 text-sm text-black">
                                Unlike traditional private keys that can be copied as text, passkeys are cryptographic
                                credentials that can't be:
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black">
                                <li>Screenshot by accident</li>
                                <li>Sent in a text message</li>
                                <li>Saved in an unsafe note app</li>
                                <li>Stolen by malware</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-black">The tradeoff</h4>
                            <p className="mt-1 text-sm text-black">
                                You get better security, but passkeys are locked to your device ecosystem (Apple or
                                Google). That's why cloud backup is critical.
                            </p>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-1">
                            <span className="mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full border border-gray-1">
                                i
                            </span>
                            <p>We're exploring advanced export options for power users in future updates.</p>
                        </div>
                    </div>
                }
            />
        </PageContainer>
    )
}
