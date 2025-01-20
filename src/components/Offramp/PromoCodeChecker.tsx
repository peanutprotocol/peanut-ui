import Icon from '@/components/Global/Icon'
import { useEffect, useState } from 'react'
import { VALID_PROMO_CODES } from './Offramp.consts'

interface PromoState {
    isExpanded: boolean
    code: string
    error: string
    isApplied: boolean
}

const INITIAL_STATE: PromoState = {
    isExpanded: false,
    code: '',
    error: '',
    isApplied: false,
}

interface PromoCodeCheckerProps {
    onPromoCodeApplied: (code: string | null) => void
    appliedPromoCode: string | null
}

const PromoCodeChecker = ({ onPromoCodeApplied, appliedPromoCode }: PromoCodeCheckerProps) => {
    const [promoCheckerState, setPromoCheckerState] = useState<PromoState>({
        ...INITIAL_STATE,
        code: appliedPromoCode || '',
        isApplied: !!appliedPromoCode,
    })

    const handlePromoCodeSubmit = () => {
        const normalizedCode = promoCheckerState.code.trim().toUpperCase()

        if (VALID_PROMO_CODES.includes(normalizedCode)) {
            setPromoCheckerState((prev) => ({
                ...prev,
                error: '',
                isApplied: true,
            }))
            onPromoCodeApplied(normalizedCode)
        } else if (normalizedCode === '') {
            setPromoCheckerState((prev) => ({
                ...prev,
                error: 'Please enter a promo code',
                isApplied: false,
            }))
            onPromoCodeApplied(null)
        } else {
            {
                setPromoCheckerState((prev) => ({
                    ...prev,
                    error: 'Invalid promo code',
                    isApplied: false,
                }))
                onPromoCodeApplied(null)
            }
        }
    }

    const handleExpandToggle = () => {
        setPromoCheckerState((prev) => ({
            ...prev,
            isExpanded: !prev.isExpanded,
            ...(prev.isExpanded && !prev.isApplied ? { code: '', error: '' } : {}),
        }))
    }

    // update state if promo code is applied
    useEffect(() => {
        if (appliedPromoCode) {
            setPromoCheckerState((prev) => ({
                ...prev,
                code: appliedPromoCode,
                isApplied: true,
            }))
        }
    }, [appliedPromoCode])

    return (
        <div className="w-full">
            {/* header */}
            {!promoCheckerState.isApplied && (
                <div
                    onClick={handleExpandToggle}
                    className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1 transition-colors duration-200 hover:bg-gray-50"
                >
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name="ticket" className="h-4 fill-grey-1" />
                        <label className="font-bold">Apply Promo Code</label>
                    </div>
                    <Icon
                        name={promoCheckerState.isExpanded ? 'chevron-up' : 'arrow-bottom'}
                        className={`h-4 fill-grey-1 transition-all duration-300`}
                    />
                </div>
            )}

            {/* expandable section */}
            <div
                className={`
                overflow-hidden transition-all duration-300 ease-in-out
                ${promoCheckerState.isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
            `}
            >
                {promoCheckerState.isApplied ? (
                    <p className="text-center text-sm text-green-600">
                        Promo code {promoCheckerState.code} applied successfully!
                    </p>
                ) : (
                    <div className="mt-2 flex w-full flex-col gap-2 px-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={promoCheckerState.code}
                                onChange={(e) => setPromoCheckerState((prev) => ({ ...prev, code: e.target.value }))}
                                placeholder="Enter promo code"
                                className={`custom-input h-8 px-3 text-xs transition-all duration-300 ${
                                    promoCheckerState.error ? 'border border-red' : ''
                                }`}
                            />
                            <button onClick={handlePromoCodeSubmit} className="btn-purple-2 btn-small">
                                Apply
                            </button>
                        </div>

                        <div
                            className={`transition-all duration-300 ${promoCheckerState.error ? 'max-h-8 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            {promoCheckerState.error && <p className="text-sm text-red">{promoCheckerState.error}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PromoCodeChecker
