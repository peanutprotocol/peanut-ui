'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, SpecificPaymentMethod } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { useParams, useRouter } from 'next/navigation'
import EmptyState from '../../Global/EmptyStates/EmptyState'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()
    const countryPathParts = Array.isArray(params.country) ? params.country : [params.country]
    const countrySlugFromUrl = countryPathParts.join('-')

    const currentCountry = countryData.find(
        (country) => country.type === 'country' && country.path === countrySlugFromUrl
    )

    if (!currentCountry) {
        return (
            <div className="space-y-8">
                <NavHeader title="Add/Withdraw Money" onPrev={() => router.push('/add-money')} />
                <EmptyState title="Country not found" description="Please try a different country." icon="search" />
            </div>
        )
    }

    const methods = COUNTRY_SPECIFIC_METHODS[currentCountry.id]

    const renderPaymentMethods = (title: string, paymentMethods: SpecificPaymentMethod[]) => {
        if (!paymentMethods || paymentMethods.length === 0) {
            return null
        }

        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">{title}</h2>
                <div className="flex flex-col">
                    {paymentMethods.map((method, index) => (
                        <SearchResultCard
                            key={method.id}
                            isDisabled={method.isSoon}
                            title={method.title}
                            description={method.description}
                            leftIcon={
                                <AvatarWithBadge name={method.title} size="extra-small" className="bg-background-30" />
                            }
                            rightContent={method.isSoon ? <StatusBadge status="soon" size="small" /> : null}
                            onClick={() => {
                                if (method.path) router.push(method.path)
                            }}
                            position={
                                paymentMethods.length === 1
                                    ? 'single'
                                    : index === 0
                                      ? 'first'
                                      : index === paymentMethods.length - 1
                                        ? 'last'
                                        : 'middle'
                            }
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full space-y-8 self-start">
            <NavHeader
                title={currentCountry.title}
                onPrev={() => router.push(flow === 'add' ? '/add-money' : '/withdraw')}
            />
            <div className="flex-1 overflow-y-auto">
                {flow === 'add' && methods?.add && renderPaymentMethods('Add money via', methods.add)}
                {flow === 'withdraw' &&
                    methods?.withdraw &&
                    renderPaymentMethods('Choose withdrawing method', methods.withdraw)}
            </div>
        </div>
    )
}

export default AddWithdrawCountriesList
