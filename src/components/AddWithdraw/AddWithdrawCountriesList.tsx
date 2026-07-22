'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, type SpecificPaymentMethod } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import Image, { type StaticImageData } from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { withdrawBankUrl, rewriteMethodPath } from '@/utils/native-routes'
import { isCapacitor } from '@/utils/capacitor'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DynamicBankAccountForm, type IBankAccountDetails } from './DynamicBankAccountForm'
import { addBankAccount } from '@/app/actions/users'
import { type AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { type Account } from '@/interfaces'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useAppDispatch } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { ActionListCard } from '@/components/ActionListCard'
import TokenAndNetworkConfirmationModal from '../Global/TokenAndNetworkConfirmationModal'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useCapabilities } from '@/hooks/useCapabilities'
import { resolveKycModalVariant, getGateUserMessage } from '@/utils/capability-gate'
import { railJurisdictionForBank } from '@/utils/bridge.utils'
import { getRegionIntent } from '@/utils/regions.utils'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useModalsContext } from '@/context/ModalsContext'
import underMaintenanceConfig, { PIX_BRAZIL_ONRAMP_MAINTENANCE } from '@/config/underMaintenance.config'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const onBack = useSafeBack(flow === 'add' ? '/add-money' : '/withdraw')

    // check if coming from send flow and what type
    const methodParam = searchParams.get('method')
    const isFromSendFlow = !!(methodParam && ['bank', 'crypto'].includes(methodParam))
    const isBankFromSend = methodParam === 'bank' && isFromSendFlow

    // hooks
    const { deviceType } = useDeviceType()
    const { user, fetchUser } = useAuth()
    const { setSelectedBankAccount, amountToWithdraw, setSelectedMethod, setAmountToWithdraw } = useWithdrawFlow()
    const dispatch = useAppDispatch()

    // inline sumsub kyc flow for bridge bank users who need verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time, derived from the destination country.
    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: () => {
            setIsKycModalOpen(false)
            // The `view: 'form'` branch below renders DynamicBankAccountForm —
            // the offramp/withdraw bank-account input form. That's correct for
            // `flow === 'withdraw'` (user enters THEIR bank account to receive
            // funds) but completely wrong for `flow === 'add'`, which needs
            // Bridge's deposit instructions (an account belonging to Bridge
            // that the user wires TO). Pre-fix this unconditional setView
            // surfaced the withdraw form under an "Add money" title — the
            // EEA QA Bug #5 ("Submitted, but still asking for account holder
            // details when I'm trying to add money"). Route add-money users
            // to /add-money/[country]/bank instead, which mounts
            // AddMoneyBankDetails (deposit-instructions display).
            if (flow === 'add') {
                const countrySlug = currentCountry?.path
                // rewriteMethodPath → native: /add-money?country=<slug>&view=bank
                router.push(countrySlug ? rewriteMethodPath(`/add-money/${countrySlug}/bank`) : '/add-money')
                return
            }
            setView('form')
        },
        onManualClose: () => setIsKycModalOpen(false),
    })

    // component level states
    const [view, setView] = useState<'list' | 'form'>(flow === 'withdraw' && amountToWithdraw ? 'form' : 'list')
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isSupportedTokensModalOpen, setIsSupportedTokensModalOpen] = useState(false)

    // read country from path params (web: /add-money/india) or query params (native: /add-money?country=india)
    const countryFromQuery = searchParams.get('country')
    const viewFromQuery = searchParams.get('view')
    const rawCountry = countryFromQuery || params.country
    const countryPathParts = Array.isArray(rawCountry) ? rawCountry : [rawCountry].filter(Boolean)
    const isBankPage = viewFromQuery === 'bank' || countryPathParts[countryPathParts.length - 1] === 'bank'
    const countrySlugFromUrl =
        isBankPage && !viewFromQuery ? countryPathParts.slice(0, -1).join('-') : countryPathParts.join('-')

    const currentCountry = countryData.find(
        (country) => country.type === 'country' && country.path === countrySlugFromUrl
    )

    // Provider-blind bank-channel deposit gate, country-scoped to the rail
    // jurisdiction of the country the user is on. Reads through
    // useCapabilities's role-aware primitives — see utils/capability-gate.ts.
    //
    // SCOPE rationale: without the country narrowing, a stuck/rejected rail in
    // an unrelated jurisdiction (e.g. a Bridge BANK_TRANSFER_MX row from the
    // 2026-06-01 sync) trips `blocked-rejection` here and the user sees
    // "We couldn't unlock this" on a country whose own rail is fine.
    //
    // The gate's `kind` is the SOLE go/no-go signal here — same as the sibling
    // /add-money/[country]/bank/page.tsx. Do NOT layer a separate "is any bank
    // rail pending?" check on top: a `ready` gate already means the user has a
    // working in-scope rail, and `deriveGate` deliberately ranks `ready` above
    // `pending`/`waiting-on-provider` so a pending sibling rail (a legit
    // second-country enrollment, a still-provisioning rail) can't re-block
    // them. The prior unscoped `isBankRailUnderReview` check did exactly that
    // and dead-ended ready users behind a "You're all set / Go back" modal.
    const { isKycApproved, gateFor } = useCapabilities()
    const isUserKycApproved = isKycApproved
    const bankCountry = useMemo(() => railJurisdictionForBank(currentCountry?.id), [currentCountry?.id])
    const gate = useMemo(() => gateFor('deposit', { channel: 'bank', country: bankCountry }), [gateFor, bankCountry])
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const [showProvideEmail, setShowProvideEmail] = useState(false)
    const { setIsSupportModalOpen } = useModalsContext()

    // stores the callback to replay after tos acceptance in the list view
    const pendingAfterTosRef = useRef<(() => void) | null>(null)

    // close kyc modal when sumsub sdk opens
    useEffect(() => {
        if (sumsubFlow.showWrapper) setIsKycModalOpen(false)
    }, [sumsubFlow.showWrapper])

    /** returns true if the user is gated (caller should return early) */
    const checkBridgeGate = useCallback(
        (onAfterTos?: () => void): boolean => {
            if (gate.kind !== 'ready') {
                // capabilities still loading OR provider doing internal review —
                // caller should wait, NOT open a KYC modal. For `loading` we
                // don't yet know if the user is approved. For `waiting-on-provider`
                // (Bridge KYC review, post_processing) there's no user action to
                // take; opening the modal would imply otherwise.
                if (gate.kind === 'loading' || gate.kind === 'waiting-on-provider') return true
                if (gate.kind === 'accept-tos') {
                    pendingAfterTosRef.current = onAfterTos ?? null
                    guardWithTos()
                } else if (gate.kind === 'provide-email') {
                    setShowProvideEmail(true)
                } else {
                    setIsKycModalOpen(true)
                }
                return true
            }
            return false
        },
        [gate, guardWithTos]
    )

    const handleFormSubmit = async (
        payload: AddBankAccountPayload,
        rawData: IBankAccountDetails
    ): Promise<{ error?: string; silent?: boolean }> => {
        // re-fetch user to ensure we have the latest KYC status
        // (the multi-phase flow may have completed but websocket/state not yet propagated)
        await fetchUser()

        // unified bridge gate: tos → fixable rejection → blocked → enrollment
        // return a non-visible error to prevent the form from treating this as success
        if (gate.kind !== 'ready') {
            // capabilities still loading OR provider doing internal review —
            // silently no-op (don't show a KYC modal). `waiting-on-provider`
            // means no user action available.
            if (gate.kind === 'loading' || gate.kind === 'waiting-on-provider') {
                return { error: 'gate_blocked', silent: true }
            }
            if (gate.kind === 'accept-tos') {
                guardWithTos()
            } else if (gate.kind === 'provide-email') {
                // A rail that flipped to email-blocked between form-open and submit
                // is self-serve — open the email sheet, NOT the contact-support KYC
                // modal (mirrors checkBridgeGate; the whole point of provide-email).
                setShowProvideEmail(true)
            } else {
                setIsKycModalOpen(true)
            }
            return { error: 'gate_blocked', silent: true }
        }

        // scenario (1): happy path: if the user has already completed kyc, we can add the bank account directly
        // email and name are now collected by sumsub — no need to check them here
        if (isUserKycApproved) {
            const currentAccountIds = new Set((user?.accounts ?? []).map((acc) => acc.id))

            const result = await addBankAccount(payload)
            if (result.error) {
                return { error: result.error }
            }
            if (!result.data) {
                return { error: 'Failed to process bank account. Please try again or contact support.' }
            }

            // after successfully adding, we refetch user data to get the new account
            // and remove any temporary data from local storage.
            const updatedUser = await fetchUser() // refetch user to get the new bank account

            const newAccount = updatedUser?.accounts.find((acc) => !currentAccountIds.has(acc.id))

            if (newAccount) {
                setSelectedBankAccount(newAccount)
            } else {
                // fallback to the previous method if we can't find the new account
                // this can happen if the user object is not updated immediately
                const newAccountFromResponse = result.data as Account
                // The freshly-added account hasn't surfaced in the user refetch yet.
                // The add-bank-account response is the projected wire shape, so it
                // already carries bridgeAccountId + the legacy `type`. Guard: without
                // a bridgeAccountId the confirm step dead-ends on "Bank account is
                // missing", so surface a retryable error rather than navigating.
                if (!newAccountFromResponse?.bridgeAccountId) {
                    return { error: 'Your bank account is still being set up. Please try again in a moment.' }
                }
                // ensure details has accountOwnerName for confirmation page display
                newAccountFromResponse.details = {
                    ...(newAccountFromResponse.details || {}),
                    countryCode: payload.countryCode,
                    countryName: payload.countryName,
                    bankName: newAccountFromResponse.details?.bankName || null,
                    accountOwnerName: `${payload.accountOwnerName.firstName} ${payload.accountOwnerName.lastName}`,
                }
                setSelectedBankAccount(newAccountFromResponse)
            }

            if (currentCountry) {
                const queryParams = isBankFromSend ? `?method=${methodParam}` : ''
                router.push(withdrawBankUrl(currentCountry.path, queryParams))
            }
            return {}
        }

        // scenario (2): if the user hasn't completed kyc yet
        // name and email are now collected by sumsub sdk — no need to save them beforehand
        if (!isUserKycApproved) {
            await sumsubFlow.handleInitiateKyc(
                getRegionIntent(currentCountry?.region ?? 'rest-of-the-world'),
                undefined,
                undefined,
                currentCountry?.id
            )
        }

        return {}
    }

    const handleWithdrawMethodClick = (method: SpecificPaymentMethod) => {
        // preserve method param only if coming from bank send flow (not crypto)
        const methodQueryParam = isBankFromSend ? `?method=${methodParam}` : ''

        if (method.path && method.path.includes('/manteca')) {
            // Manteca methods route directly (has own amount input)
            const extraParams = isBankFromSend ? `method=${methodParam}` : undefined
            router.push(rewriteMethodPath(method.path, extraParams))
        } else if (method.id.includes('default-bank-withdraw') || method.id.includes('sepa-instant-withdraw')) {
            if (checkBridgeGate(() => handleWithdrawMethodClick(method))) return

            // Bridge methods: Set in context and navigate for amount input
            setSelectedMethod({
                type: 'bridge',
                countryPath: currentCountry?.path,
                currency: currentCountry?.currency,
                title: method.title,
            })
            router.push(`/withdraw${methodQueryParam}`)
            return
        } else if (method.id.includes('crypto-withdraw')) {
            setSelectedMethod({
                type: 'crypto',
                countryPath: 'crypto',
                title: 'Crypto',
            })
            router.push(`/withdraw${methodQueryParam}`)
        } else if (method.path) {
            // other methods with paths — rewrite dynamic routes for native
            const extraParams = isBankFromSend ? `method=${methodParam}` : undefined
            router.push(rewriteMethodPath(method.path, extraParams))
        }
    }

    const handleAddMethodClick = (method: SpecificPaymentMethod) => {
        if (method.path) {
            if (method.id === 'crypto-add') {
                setIsSupportedTokensModalOpen(true)
                return
            }
            if (checkBridgeGate(() => handleAddMethodClick(method))) return

            const target = rewriteMethodPath(method.path)
            // force full navigation in capacitor — router.push to same page with
            // different query params doesn't trigger useSearchParams re-render in static export
            if (isCapacitor() && target.startsWith(window.location.pathname)) {
                window.location.href = target
            } else {
                router.push(target)
            }
        }
    }

    const methods = useMemo(() => {
        if (!currentCountry) return undefined

        const countryMethods = COUNTRY_SPECIFIC_METHODS[currentCountry.id]
        if (!countryMethods) return undefined

        if (flow !== 'add') {
            return countryMethods
        }

        // filter apple pay and google pay for add flow based on device type
        const filteredAddMethods = (countryMethods.add || []).filter((method) => {
            if (method.id === 'apple-pay-add') {
                return deviceType === DeviceType.IOS || deviceType === DeviceType.WEB
            }
            if (method.id === 'google-pay-add') {
                return deviceType === DeviceType.ANDROID || deviceType === DeviceType.WEB
            }

            return true
        })

        return {
            ...countryMethods,
            add: filteredAddMethods,
        }
    }, [currentCountry, flow, deviceType])

    if (!currentCountry) {
        return (
            <div className="space-y-8 self-start">
                <NavHeader title="Not Found" onPrev={onBack} />
                <EmptyState title="Country not found" description="Please try a different country." icon="search" />
            </div>
        )
    }

    // shared modals — rendered once regardless of view (form vs list)
    const sharedModals = (
        <>
            <InitiateKycModal
                visible={isKycModalOpen}
                onClose={() => setIsKycModalOpen(false)}
                onVerify={async () => {
                    if (gate.kind === 'fixable-rejection') {
                        await sumsubFlow.handleSelfHealResubmit('BRIDGE')
                    } else {
                        await sumsubFlow.handleInitiateKyc(
                            getRegionIntent(currentCountry?.region ?? 'rest-of-the-world'),
                            undefined,
                            gate.kind === 'needs-enrollment' || undefined,
                            currentCountry?.id
                        )
                    }
                }}
                onContactSupport={() => {
                    setIsKycModalOpen(false)
                    setIsSupportModalOpen(true)
                }}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={resolveKycModalVariant(gate)}
                providerMessage={getGateUserMessage(gate)}
                regionName={currentCountry?.title}
            />
            <BridgeTosStep
                visible={showBridgeTos}
                onComplete={() => {
                    hideTos()
                    const replay = pendingAfterTosRef.current
                    pendingAfterTosRef.current = null
                    if (replay) replay()
                    else formRef.current?.handleSubmit()
                }}
                onSkip={hideTos}
                reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
            />
            <ProvideEmailStep
                visible={showProvideEmail}
                onComplete={() => setShowProvideEmail(false)}
                onSkip={() => setShowProvideEmail(false)}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </>
    )

    if (view === 'form') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader
                    title={flow === 'withdraw' ? (isBankFromSend ? 'Send' : 'Withdraw') : 'Add money'}
                    onPrev={() => {
                        // clear dynamicbankaccountform data
                        dispatch(bankFormActions.clearFormData())
                        setAmountToWithdraw('')
                        // ensure kyc modal isn't open so late success events don't flip view
                        setIsKycModalOpen(false)

                        // if coming from send flow, go back to amount input on /withdraw?method=bank
                        if (flow === 'withdraw' && isBankFromSend) {
                            if (currentCountry) {
                                setSelectedMethod({
                                    type: 'bridge',
                                    countryPath: currentCountry.path,
                                    currency: currentCountry.currency,
                                    title: 'To Bank',
                                })
                            }
                            router.push(`/withdraw?method=${methodParam}`)
                            return
                        }

                        // otherwise go back to list
                        setSelectedMethod(null)
                        setView('list')
                    }}
                />
                <DynamicBankAccountForm
                    ref={formRef}
                    country={getCountryCodeForWithdraw(currentCountry.id)}
                    onSuccess={handleFormSubmit}
                    initialData={{}}
                    error={null}
                />
                {sharedModals}
            </div>
        )
    }

    const renderPaymentMethods = (title: string, paymentMethods: SpecificPaymentMethod[]) => {
        if (!paymentMethods || paymentMethods.length === 0) {
            return null
        }

        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">{title}</h2>
                <div className="flex flex-col">
                    {paymentMethods.map((method, index) => {
                        // BRL-via-PIX onramp is warn-only under maintenance: tag the Pix option but
                        // keep it clickable (do not set isDisabled).
                        const isPixOnrampUnderMaintenance =
                            flow === 'add' &&
                            method.id === 'pix-add' &&
                            underMaintenanceConfig.pixBrazilOnrampMaintenance
                        return (
                            <ActionListCard
                                key={method.id}
                                isDisabled={method.isSoon}
                                title={method.title}
                                description={method.description}
                                descriptionClassName={'text-xs'}
                                leftIcon={
                                    typeof method.icon === 'string' || method.icon === undefined ? (
                                        <AvatarWithBadge
                                            icon={method.icon as IconName}
                                            name={method.title ?? method.id}
                                            size="extra-small"
                                            inlineStyle={{
                                                backgroundColor:
                                                    method.icon === ('bank' as IconName)
                                                        ? '#FFC900'
                                                        : method.id === 'crypto-add' || method.id === 'crypto-withdraw'
                                                          ? '#FFC900'
                                                          : getColorForUsername(method.title).lightShade,
                                                color: method.icon === ('bank' as IconName) ? 'black' : 'black',
                                            }}
                                        />
                                    ) : (
                                        <Image
                                            src={method.icon as StaticImageData}
                                            alt={method.id}
                                            className="h-8 w-8 rounded-full"
                                            width={32}
                                            height={32}
                                        />
                                    )
                                }
                                rightContent={
                                    method.isSoon ? (
                                        <StatusBadge status="soon" size="small" />
                                    ) : isPixOnrampUnderMaintenance ? (
                                        <StatusBadge
                                            status="pending"
                                            customText={PIX_BRAZIL_ONRAMP_MAINTENANCE.badge}
                                            size="small"
                                        />
                                    ) : null
                                }
                                onClick={() => {
                                    if (flow === 'withdraw') {
                                        handleWithdrawMethodClick(method)
                                    } else if (method.path) {
                                        handleAddMethodClick(method)
                                    }
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
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full space-y-8 self-start">
            <NavHeader
                title={currentCountry.title}
                onPrev={() => {
                    setAmountToWithdraw('')
                    if (flow === 'add') {
                        // root add-money is the country list now (the ?method=bank
                        // method screen was removed) — no stale param.
                        router.push('/add-money')
                    } else if (isBankFromSend) {
                        // if coming from bank send flow: set method and go to amount input view
                        setSelectedMethod({
                            type: 'bridge',
                            countryPath: currentCountry.path,
                            currency: currentCountry.currency,
                            title: 'To Bank',
                        })
                        router.push(`/withdraw?method=${methodParam}`)
                    } else {
                        setSelectedMethod(null)
                        onBack()
                    }
                }}
            />
            <div className="flex-1 overflow-y-auto">
                {flow === 'add' && methods?.add && renderPaymentMethods('Add money via', methods.add)}
                {flow === 'withdraw' &&
                    methods?.withdraw &&
                    renderPaymentMethods('Choose withdrawing method', methods.withdraw)}
            </div>
            {flow === 'add' && (
                <TokenAndNetworkConfirmationModal
                    onClose={() => {
                        setIsSupportedTokensModalOpen(false)
                    }}
                    onAccept={() => {
                        router.push('/add-money/crypto')
                    }}
                    isVisible={isSupportedTokensModalOpen}
                />
            )}
            {sharedModals}
        </div>
    )
}

export default AddWithdrawCountriesList
