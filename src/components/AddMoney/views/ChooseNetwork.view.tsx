'use client'

import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import NavHeader from '@/components/Global/NavHeader'
import { Section } from '@/components/0_Bruddle/Section'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NetworkList from '@/components/AddMoney/components/NetworkList'
import type { RhinoChainType } from '@/services/services.types'
import { useTranslations } from 'next-intl'

interface ChooseNetworkViewProps {
    onSelect: (network: RhinoChainType) => void
    onBack: () => void
}

/**
 * network selection page per the Add/Crypto board (17830:78020): "Add crypto"
 * title, "Choose network" heading, one row per chain family.
 */
const ChooseNetworkView = ({ onSelect, onBack }: ChooseNetworkViewProps) => {
    const t = useTranslations('addMoney')

    return (
        <PageStack>
            <NavHeader title={t('addCryptoTitle')} onPrev={onBack} />
            <ScreenMark icon="plus" />
            <Section title={t('networkDrawer.title')} className="gap-4">
                <NetworkList onSelect={onSelect} />
            </Section>
        </PageStack>
    )
}

export default ChooseNetworkView
