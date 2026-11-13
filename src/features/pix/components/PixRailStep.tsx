'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import NavHeader from '@/components/Global/NavHeader'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { PIX_COUNTRY } from '@/features/pix/pixRoute.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useGateActions, type GateStart } from '@/hooks/useGateActions'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import type { CapabilityRoute } from '@/types/capabilities'
import type { ProviderId } from '@/types/provider.types'
import { gateFromEntry, getGateReasonCode, getGateUserMessage, resolveKycModalVariant } from '@/utils/capability-gate'

/** The route's provider as the identity flow names the provider whose fix it runs. */
const FIX_PROVIDER: Partial<Record<NonNullable<CapabilityRoute['provider']>, GateStart['provider']>> = {
    bridge: 'BRIDGE',
    manteca: 'MANTECA',
}

/**
 * A Pix route's step in the kinds the bank rails use (`rail-step`): the provider's rail asks for its
 * terms, a document, its hosted check, the missing email or a new identity document. The step goes to
 * the screens the bank rails show for it, wired as `useDepositGateRemediation` wires them: the terms
 * and the email are sheets (`BridgeTosStep`, `ProvideEmailStep`) that open on arrival over the Pix
 * setup page, and the rest is the verification step page (`InitiateKycModal`), whose button runs the
 * gate's remedy (`useGateActions`). The hosted check comes back here when it is done. Once the step is
 * done the route moves on, and the Pix setup shows what it says next.
 */
export function PixRailStep({
    title,
    onBack,
    route,
    providerId,
}: {
    title: string
    onBack: () => void
    route: CapabilityRoute
    providerId: ProviderId | null
}) {
    const t = useTranslations('pix.setup')
    const tCommon = useTranslations('common')
    const pathname = usePathname()
    const { rails, nextActions } = useCapabilities()
    const sumsubFlow = useMultiPhaseKycFlow({})
    const gateActions = useGateActions(sumsubFlow)
    // the tap that opened Pix asked for the step: its sheet opens at once, and the page keeps a way back to it
    const [sheetOpen, setSheetOpen] = useState(true)
    const closeSheet = () => setSheetOpen(false)
    const fixProvider = route.provider ? FIX_PROVIDER[route.provider] : undefined
    if (!fixProvider) return <PixUnavailableScreen title={title} route={route} onBack={onBack} />

    // the route's step in the gate's words, as the bank rails' screens read it
    const gate = gateFromEntry(
        {
            state: 'action_required',
            action: route.action,
            reason: route.reason?.code,
            message: route.reason?.userMessage,
        },
        { rails, nextActions }
    )
    const start: GateStart = { provider: fixProvider, returnTo: pathname }

    if (gate.kind === 'accept-tos' || gate.kind === 'provide-email') {
        return (
            <>
                <PageStack>
                    <NavHeader title={title} onPrev={onBack} />
                    <PageStack.Center>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <IconBubble {...CONCEPT_ICONS.pix} size="l" />
                            <TitleBlock align="center" title={t('title')} />
                        </div>
                        <div className="flex flex-col gap-4">
                            <Button variant="primary" className="w-full" onClick={() => setSheetOpen(true)}>
                                {tCommon('continue')}
                            </Button>
                            {providerId && (
                                <ProviderFinePrint providerId={providerId} label="accountProvider" prospective />
                            )}
                        </div>
                    </PageStack.Center>
                </PageStack>
                {gate.kind === 'accept-tos' ? (
                    <BridgeTosStep
                        visible={sheetOpen}
                        country={PIX_COUNTRY}
                        onComplete={closeSheet}
                        onSkip={closeSheet}
                    />
                ) : (
                    <ProvideEmailStep visible={sheetOpen} onComplete={closeSheet} onSkip={closeSheet} />
                )}
            </>
        )
    }

    return (
        <>
            {/* the step's button starts the Sumsub run, so its host is mounted with it */}
            <SumsubKycModals flow={sumsubFlow} onCooldownClose={onBack} />
            <InitiateKycModal
                cooldownActive={!!sumsubFlow.errorCooldown}
                visible
                presentation="page"
                navTitle={title}
                onBack={onBack}
                onClose={onBack}
                onVerify={() => gateActions.verify(gate, start)}
                onContactSupport={() => gateActions.contactSupport(gate)}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={resolveKycModalVariant(gate)}
                providerMessage={getGateUserMessage(gate)}
                reasonCode={getGateReasonCode(gate)}
                nextAction={gate.kind === 'fixable-rejection' ? gate.nextAction : undefined}
                providerId={providerId ?? undefined}
            />
        </>
    )
}
