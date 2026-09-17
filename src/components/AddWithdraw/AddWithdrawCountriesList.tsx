'use client'

import { COUNTRY_SPECIFIC_METHODS, countryData, type SpecificPaymentMethod } from '@/components/AddMoney/consts'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Section } from '@/components/0_Bruddle/Section'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import Image, { type StaticImageData } from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useSafeBack } from '@/hooks/useSafeBack'
import { rewriteMethodPath } from '@/utils/native-routes'
import { isCapacitor } from '@/utils/capacitor'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DynamicBankAccountForm, type IBankAccountDetails } from './DynamicBankAccountForm'
import { addBankAccount } from '@/app/actions/users'
import { type AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useOptionalWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { useWithdrawAmount } from '@/features/withdraw/useWithdrawAmount'
import { withdrawAmountStepUrl } from '@/features/withdraw/routes'
import { liveRailsForCountry } from '@/features/destinations/country-rails'
import { type Account } from '@/interfaces/interfaces'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import TokenAndNetworkConfirmationDrawer from '../Global/TokenAndNetworkConfirmationDrawer'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useCapabilities } from '@/hooks/useCapabilities'
import { resolveKycModalVariant, getGateUserMessage, getGateReasonCode } from '@/utils/capability-gate'
import { railJurisdictionForBank } from '@/utils/bridge.utils'
import { useBankRegionIntent } from '@/hooks/useBankRegionIntent'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useModalsContext } from '@/context/ModalsContext'
import underMaintenanceConfig, { PIX_BRAZIL_ONRAMP_MAINTENANCE } from '@/config/underMaintenance.config'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'

interface AddWithdrawCountriesListProps {
    flow: 'add' | 'withdraw'
}

const AddWithdrawCountriesList = ({ flow }: AddWithdrawCountriesListProps) => {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const onBack = useSafeBack(flow === 'add' ? '/add-money' : '/withdraw')
    const locale = useLocale()
    const t = useTranslations('withdraw')
    const tAddMoney = useTranslations('addMoney')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')

    // check if coming from send flow and what type
    const methodParam = searchParams.get('method')
    // this list also serves the add-money flow, which navigates with its own
    // ?method=bank — so the marker alone doesn't mean "send". Same guard as
    // AddWithdrawRouterView.
    const isBankFromSend = useSendFlowOrigin().isBankFromSend && flow === 'withdraw'

    // hooks
    const { deviceType } = useDeviceType()
    const { user, fetchUser } = useAuth()
    // Withdraw flow memory is scoped to /withdraw — null under /add-money.
    // Every write below is inside a `flow === 'withdraw'` branch.
    const withdrawFlow = useOptionalWithdrawFlow()
    // the one typed amount, carried in the URL across /withdraw/* routes
    const [urlAmount, setUrlAmount] = useWithdrawAmount()

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
            void setStepParam('form')
        },
        onManualClose: () => setIsKycModalOpen(false),
    })

    // component level states. The screen is named in the URL, not inferred:
    // `?step=form` is the bank-account form, no `step` is the rail list. It used
    // to flip to the form purely because `?amount=` was present, which tied the
    // screen to a value that now arrives AFTER the destination (TASK-22589).
    // `step` is the name every flow in the app gives its cursor; `?view=` stays
    // the native route selector (`?view=bank` is a rewritten path segment, not
    // a step) and old `?view=form` links are rewritten below.
    const [stepParam, setStepParam] = useQueryState('step', parseAsStringEnum(['form']))
    const [viewParam, setViewParam] = useQueryState('view', parseAsStringEnum(['form', 'bank']))
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isSupportedTokensModalOpen, setIsSupportedTokensModalOpen] = useState(false)

    // read country from path params (web: /add-money/india) or query params (native: /add-money?country=india)
    const countryFromQuery = searchParams.get('country')
    const viewFromQuery = viewParam
    const rawCountry = countryFromQuery || params.country
    const countryPathParts = Array.isArray(rawCountry) ? rawCountry : [rawCountry].filter(Boolean)
    const isBankPage = viewFromQuery === 'bank' || countryPathParts[countryPathParts.length - 1] === 'bank'
    const countrySlugFromUrl =
        isBankPage && !viewFromQuery ? countryPathParts.slice(0, -1).join('-') : countryPathParts.join('-')

    // Old links still say "form" two older ways: /withdraw/<country>?amount=50
    // was the bank form before the screen got its own name, and `?view=form`
    // was that name for one release. Name it `step`, keep the amount, and the
    // user lands where the link meant to send them.
    useEffect(() => {
        if (flow !== 'withdraw' || stepParam) return
        if (viewParam === 'form') {
            void setViewParam(null)
            void setStepParam('form')
            return
        }
        if (urlAmount) void setStepParam('form')
    }, [flow, stepParam, viewParam, urlAmount, setStepParam, setViewParam])

    const currentCountry = countryData.find(
        (country) => country.type === 'country' && country.path === countrySlugFromUrl
    )

    // The country's live withdraw rails answer two questions on this screen:
    // which rail the bank form is collecting details for, and whether the rail
    // list was skipped on the way in. One live rail means it was — the country
    // pick goes straight to the form (see WithdrawMethodView).
    const liveRails = useMemo(
        () => (flow === 'withdraw' && currentCountry ? liveRailsForCountry(currentCountry.id, 'withdraw') : []),
        [flow, currentCountry]
    )
    const bankRail = liveRails.find((rail) => rail.id.endsWith('-default-bank-withdraw'))
    const railListSkipped = liveRails.length === 1
    const view =
        stepParam === 'form' || (railListSkipped && bankRail && !bankRail.path?.includes('/manteca')) ? 'form' : 'list'

    useEffect(() => {
        const rail = liveRails.length === 1 ? liveRails[0] : undefined
        if (rail?.path?.includes('/manteca')) {
            const extra = new URLSearchParams()
            if (isBankFromSend && methodParam) extra.set('sendMethod', methodParam)
            if (urlAmount) extra.set('amount', urlAmount)
            router.replace(rewriteMethodPath(rail.path, extra.toString()))
        }
    }, [liveRails, router, isBankFromSend, methodParam, urlAmount])

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
    const bankRegionIntent = useBankRegionIntent()
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
        _rawData: IBankAccountDetails
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
                return { error: tAddMoney('errors.bankAccountFailed') }
            }

            // after successfully adding, we refetch user data to get the new account
            // and remove any temporary data from local storage.
            const updatedUser = await fetchUser() // refetch user to get the new bank account

            const newAccount = updatedUser?.accounts.find((acc) => !currentAccountIds.has(acc.id))

            if (newAccount) {
                withdrawFlow?.setSelectedBankAccount(newAccount)
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
                    return { error: tAddMoney('errors.bankAccountSettingUp') }
                }
                // ensure details has accountOwnerName for confirmation page display
                newAccountFromResponse.details = {
                    ...(newAccountFromResponse.details || {}),
                    countryCode: payload.countryCode,
                    countryName: payload.countryName,
                    bankName: newAccountFromResponse.details?.bankName || null,
                    accountOwnerName: `${payload.accountOwnerName.firstName} ${payload.accountOwnerName.lastName}`,
                }
                withdrawFlow?.setSelectedBankAccount(newAccountFromResponse)
            }

            // The destination is settled — the amount step is next, and it is
            // the last thing the user fills in before the review.
            selectBankMethod()
            router.push(withdrawAmountStepUrl({ method: isBankFromSend ? methodParam : null, amount: urlAmount }))
            return {}
        }

        // scenario (2): if the user hasn't completed kyc yet
        // name and email are now collected by sumsub sdk — no need to save them beforehand
        if (!isUserKycApproved) {
            await sumsubFlow.handleInitiateKyc(
                bankRegionIntent(currentCountry),
                undefined,
                undefined,
                currentCountry?.id
            )
        }

        return {}
    }

    /**
     * Name the bank rail in flow memory. The form can also be entered cold — a
     * refresh, or a link straight to `?view=form` — and memory does not survive
     * that, so both handoffs out of the form call this rather than assume the
     * rail list set it. Without it the amount step's guard sees no method and
     * bounces the user back, losing the account they just added.
     */
    const selectBankMethod = useCallback(
        (title?: string) => {
            withdrawFlow?.setSelectedMethod({
                type: 'bridge',
                countryPath: currentCountry?.path,
                currency: currentCountry?.currency,
                title: title ?? bankRail?.title,
            })
        },
        [withdrawFlow, currentCountry, bankRail]
    )

    const handleWithdrawMethodClick = (method: SpecificPaymentMethod) => {
        if (method.path && method.path.includes('/manteca')) {
            // Manteca methods route directly (has own amount input)
            const extraParams = isBankFromSend ? `method=${methodParam}` : undefined
            router.push(rewriteMethodPath(method.path, extraParams))
        } else if (method.id.includes('default-bank-withdraw')) {
            if (checkBridgeGate(() => handleWithdrawMethodClick(method))) return

            // Bridge methods: set in context and open the bank-account form.
            // The amount comes after the destination now (TASK-22589).
            selectBankMethod(method.title)
            void setViewParam('form')
            return
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
                <NavHeader title={tCommon('notFound')} onPrev={onBack} />
                <EmptyState
                    title={tCommon('countryNotFound')}
                    description={tCommon('tryDifferentCountry')}
                    icon="search"
                />
            </div>
        )
    }

    // shared modals — rendered once regardless of view (form vs list)
    const sharedModals = (
        <>
            <InitiateKycModal
                cooldownActive={!!sumsubFlow.errorCooldown}
                visible={isKycModalOpen}
                onClose={() => setIsKycModalOpen(false)}
                onVerify={async () => {
                    if (gate.kind === 'fixable-rejection') {
                        // Through the shared router: it sends a residence park to the
                        // address step and everything else to resubmit as before.
                        await sumsubFlow.handleFixableGate('BRIDGE', gate)
                    } else {
                        await sumsubFlow.handleInitiateKyc(
                            bankRegionIntent(currentCountry),
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
                reasonCode={getGateReasonCode(gate)}
                regionName={currentCountry && localizedCountryTitle(locale, currentCountry)}
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
            <SumsubKycModals flow={sumsubFlow} onCooldownClose={() => setIsKycModalOpen(false)} />
        </>
    )

    if (view === 'form') {
        return (
            <div className="flex min-h-inherit flex-col justify-normal gap-8">
                <NavHeader
                    title={
                        flow === 'withdraw' ? (isBankFromSend ? tNav('send') : tNav('withdraw')) : tAddMoney('title')
                    }
                    onPrev={() => {
                        // ensure kyc modal isn't open so late success events don't flip view
                        setIsKycModalOpen(false)
                        withdrawFlow?.setSelectedMethod(null)

                        // The rail list was skipped on the way in, so going back
                        // to it would land the user on a screen they never chose.
                        // Return them to the country pick instead.
                        if (railListSkipped) {
                            withdrawFlow?.setSelectedBankAccount(null)
                            router.push(
                                isBankFromSend
                                    ? `/withdraw?showAll=true&method=${methodParam}`
                                    : '/withdraw?showAll=true'
                            )
                            return
                        }
                        // Only update query state when staying on this route. A queued
                        // nuqs update can otherwise overwrite the country-list navigation.
                        void setUrlAmount(null)
                        void setStepParam(null)
                        void setViewParam(null)
                    }}
                />
                <DynamicBankAccountForm
                    ref={formRef}
                    country={getCountryCodeForWithdraw(currentCountry.id)}
                    onSuccess={handleFormSubmit}
                    initialData={{}}
                    error={null}
                    amountDisplay={urlAmount}
                    onExistingAccount={(account) => {
                        // the typed account already exists — select it and carry
                        // on to the amount step, keeping the send marker
                        selectBankMethod()
                        withdrawFlow?.setSelectedBankAccount(account)
                        router.push(
                            withdrawAmountStepUrl({ method: isBankFromSend ? methodParam : null, amount: urlAmount })
                        )
                    }}
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
            <Section title={title}>
                <div className="flex flex-col">
                    {paymentMethods.map((method, index) => {
                        // BRL-via-PIX onramp is warn-only under maintenance: tag the Pix option but
                        // keep it clickable (do not set isDisabled).
                        const isPixOnrampUnderMaintenance =
                            flow === 'add' &&
                            method.id === 'pix-add' &&
                            underMaintenanceConfig.pixBrazilOnrampMaintenance
                        return (
                            <ListItem
                                key={method.id}
                                disabled={method.isSoon}
                                title={method.title}
                                body={<div className="text-body-xs">{method.description}</div>}
                                leading={
                                    typeof method.icon === 'string' || method.icon === undefined ? (
                                        <AvatarWithBadge
                                            icon={method.icon as IconName}
                                            name={method.title ?? method.id}
                                            size="extra-small"
                                            inlineStyle={{
                                                backgroundColor:
                                                    method.icon === ('bank' as IconName)
                                                        ? 'var(--color-background-icon-bubble-yellow)'
                                                        : method.id === 'crypto-add' || method.id === 'crypto-withdraw'
                                                          ? 'var(--color-background-icon-bubble-yellow)'
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
                                trailing={
                                    method.isSoon ? (
                                        <StatusBadge status="soon" size="small" />
                                    ) : isPixOnrampUnderMaintenance ? (
                                        <StatusBadge
                                            status="pending"
                                            customText={tAddMoney(PIX_BRAZIL_ONRAMP_MAINTENANCE.badgeKey)}
                                            size="small"
                                        />
                                    ) : null
                                }
                                chevron={!method.isSoon && !isPixOnrampUnderMaintenance}
                                onClick={() => {
                                    if (flow === 'withdraw') {
                                        handleWithdrawMethodClick(method)
                                    } else if (method.path) {
                                        handleAddMethodClick(method)
                                    }
                                }}
                                position={getCardPosition(index, paymentMethods.length)}
                            />
                        )
                    })}
                </div>
            </Section>
        )
    }

    return (
        <div className="space-y-8 w-full self-start">
            <NavHeader
                title={localizedCountryTitle(locale, currentCountry)}
                onPrev={() => {
                    if (flow === 'add') {
                        router.push('/add-money?method=bank')
                    } else {
                        withdrawFlow?.setSelectedMethod(null)
                        withdrawFlow?.setSelectedBankAccount(null)
                        void setUrlAmount(null)
                        router.push(
                            isBankFromSend ? `/withdraw?showAll=true&method=${methodParam}` : '/withdraw?showAll=true'
                        )
                    }
                }}
            />
            <div className="flex-1 overflow-y-auto">
                {flow === 'add' && methods?.add && renderPaymentMethods(tAddMoney('addMoneyVia'), methods.add)}
                {flow === 'withdraw' &&
                    methods?.withdraw &&
                    renderPaymentMethods(t('chooseWithdrawingMethod'), methods.withdraw)}
            </div>
            {flow === 'add' && (
                <TokenAndNetworkConfirmationDrawer
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
