'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import type { CountryData } from '@/components/AddMoney/consts'
import { CountryList } from '@/components/Common/CountryList'
import NavHeader from '@/components/Global/NavHeader'
import { useTranslations } from 'next-intl'

interface AddMoneyBankCountryListViewProps {
    onBack: () => void
    onCountryClick: (country: CountryData) => void
}

// ?method=bank: the bank country list (board Page/Add/Bank 17830:77534)
export function AddMoneyBankCountryListView({ onBack, onCountryClick }: AddMoneyBankCountryListViewProps) {
    const t = useTranslations('addMoney')

    return (
        <PageStack>
            <NavHeader title={t('methods.bankTransfer')} onPrev={onBack} />
            <CountryList
                inputTitle={t('selectYourCountry')}
                viewMode="add-withdraw"
                flow="add"
                onCountryClick={onCountryClick}
            />
        </PageStack>
    )
}
