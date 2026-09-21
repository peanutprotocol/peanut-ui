'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Field } from '@/components/0_Bruddle/Field'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useForm, Controller, type FieldPath, type PathValue, type RegisterOptions } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { type AddBankAccountPayload, BridgeAccountOwnerType, BridgeAccountType } from '@/app/actions/types/users.types'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect, { type BaseSelectOption } from '@/components/0_Bruddle/BaseSelect'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { useParams, useSearchParams } from 'next/navigation'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { validateIban, validateBankAccount, validateBic } from '@/utils/bridge-accounts.utils'
import { scrollClearOfBottomNav } from '@/utils/bottom-nav-clearance.utils'
import { bicCountryDiffersFromIban } from './bicIbanCountry.utils'
import { ISO_9362_BIC } from '@/constants/iban-bic.consts'
import { bankCorridorFor, type BankCorridorField } from '@/components/AddWithdraw/bank-corridors'
import { getBicFromIban } from '@/app/actions/ibanToBic'
import PeanutActionDetailsCard, { type PeanutActionDetailsCardProps } from '../Global/PeanutActionDetailsCard'
import { type Account } from '@/interfaces/interfaces'
import { getCountryFromIban, getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import {
    createSmartPasteHandler,
    extractPaymentValue,
    readClipboard,
    type PasteFieldKind,
} from '@/utils/clipboard-extract.utils'
import { useToast } from '@/components/0_Bruddle/Toast'
import { twMerge } from '@/utils/tw'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useDebounce } from '@/hooks/useDebounce'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { useTranslations } from 'next-intl'

export type IBankAccountDetails = {
    name?: string
    firstName: string
    lastName: string
    accountOwnerName?: string // single field for withdraw flow
    email: string
    accountNumber: string
    bic: string
    routingNumber: string
    sortCode: string // uk bank accounts
    clabe: string
    street: string
    city: string
    state: string
    postalCode: string
    iban: string
    country: string
    // colombian bank accounts
    documentType?: string
    documentNumber?: string
    bankCode?: string
    accountCategory?: string
    phoneNumber?: string
}

interface DynamicBankAccountFormProps {
    country: string
    countryName?: string
    onSuccess: (
        payload: AddBankAccountPayload,
        rawData: IBankAccountDetails
    ) => Promise<{ error?: string; silent?: boolean }>
    initialData?: Partial<IBankAccountDetails>
    flow?: 'claim' | 'withdraw'
    actionDetailsProps?: Partial<PeanutActionDetailsCardProps>
    error: string | null
    hideEmailInput?: boolean
    /** Amount shown on the details card (withdraw flow passes the URL amount). */
    amountDisplay?: string
    /** Withdraw flow: the typed account already exists — select it and skip the add.
     *  When omitted (claim flow) submission proceeds normally. */
    onExistingAccount?: (account: Account) => void
}

export const DynamicBankAccountForm = forwardRef<{ handleSubmit: () => void }, DynamicBankAccountFormProps>(
    (
        {
            country,
            onSuccess,
            initialData,
            flow = 'withdraw',
            actionDetailsProps,
            countryName: countryNameFromProps,
            error,
            hideEmailInput = false,
            amountDisplay,
            onExistingAccount,
        },
        ref
    ) => {
        // One entry per country says what its account looks like — see bank-corridors.ts.
        const corridor = bankCorridorFor(country)
        const isIban = corridor?.accountType === BridgeAccountType.IBAN
        const isUk = corridor?.accountType === BridgeAccountType.GB
        const isUs = corridor?.accountType === BridgeAccountType.US
        const { user } = useAuth()
        const t = useTranslations('withdraw.bankForm')
        /** The corridor table names its keys as plain strings. */
        const tKey = (key: string) => t(key as Parameters<typeof t>[0])
        const tWithdraw = useTranslations('withdraw')
        const tCommon = useTranslations('common')
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [submissionError, setSubmissionError] = useState<string | null>(null)
        const { country: countryNameParams } = useParams()
        // Native/Capacitor passes country as a query param (?country=usa), so
        // useParams() is empty there — fall back to searchParams and finally the
        // `country` prop so this never derefs undefined (white-screen crash).
        const searchParams = useSearchParams()
        // This form also serves the claim flow, where the send marker is meaningless.
        const { isFromSendFlow } = useSendFlowOrigin()
        const framedAsSend = isFromSendFlow && flow === 'withdraw'
        const savedAccounts = useSavedAccounts()
        const [isCheckingBICValid, setisCheckingBICValid] = useState(false)
        // The provider needs a BIC with every IBAN. Where the bundled table knows
        // the bank (AT/BE/DE/ES/FR/LU/NL) the form derives the BIC and hides the
        // field; for every other IBAN the field shows and is required. See
        // syncBicWithIban.
        const [bicAutoFilled, setBicAutoFilled] = useState(false)
        // The BIC the form derived, so a change of IBAN can tell a derived BIC
        // (now stale) from one the user typed.
        const ctaRef = useRef<HTMLDivElement>(null)
        const derivedBicRef = useRef<string | null>(null)
        // the IBAN that BIC was derived from, so a failed lookup can tell "same IBAN" from "new one"
        const derivedForIbanRef = useRef<string | null>(null)
        // the IBAN whose BIC the user corrected by hand, so re-deriving at
        // submit cannot quietly put our answer back over theirs. Holds one IBAN,
        // never a set: a correction does not survive a change of IBAN.
        const correctedForIbanRef = useRef<string | null>(null)
        const toast = useToast()
        const STREET_ADDRESS_MAX_LENGTH = 35 // From bridge docs: street address can be max 35 characters

        let selectedCountry = (
            countryNameFromProps ??
            (countryNameParams as string) ??
            searchParams.get('country') ??
            country ??
            ''
        ).toLowerCase()

        // for claim flow: pre-fill accountOwnerName from user if logged in, for withdraw flow: keep empty
        const defaultAccountOwnerName = flow === 'claim' && user?.user.fullName ? user.user.fullName : ''

        const {
            control,
            handleSubmit,
            setValue,
            setError,
            getValues,
            watch,
            formState: { errors, isValid, isValidating, touchedFields },
        } = useForm<IBankAccountDetails>({
            defaultValues: {
                firstName: '', // kept for backwards compatibility but not used in UI
                lastName: '', // kept for backwards compatibility but not used in UI
                accountOwnerName: defaultAccountOwnerName,
                email: flow === 'claim' ? (user?.user.email ?? '') : '', // only pre-fill email in claim flow
                accountNumber: '',
                bic: '',
                routingNumber: '',
                sortCode: '', // uk bank accounts
                clabe: '',
                street: '',
                city: '',
                state: '',
                postalCode: '',
                documentType: '',
                documentNumber: '',
                bankCode: '',
                accountCategory: '',
                phoneNumber: '',
                ...initialData,
            },
            mode: 'onBlur',
            reValidateMode: 'onSubmit',
        })

        // Watch BIC field value for debouncing
        const bicValue = watch('bic')
        const debouncedBicValue = useDebounce(bicValue, 500) // 500ms delay

        useImperativeHandle(ref, () => ({
            handleSubmit: handleSubmit(onSubmit),
        }))

        // Trigger BIC validation when debounced value changes
        useEffect(() => {
            if (isIban && debouncedBicValue && debouncedBicValue.trim().length > 0) {
                // Trigger validation for the BIC field
                setValue('bic', debouncedBicValue, { shouldValidate: true })
            }
        }, [debouncedBicValue, isIban, setValue])

        // The form is taller than a small phone, and at 375x667 its button rests
        // half behind the bottom nav: on screen, and a tap on it switches tabs.
        // The moment the form can be submitted, the button is brought clear of
        // the nav. The page moves only as far as that takes, so a user still
        // typing in the last field keeps it in view.
        const canSubmit = isValid && !isValidating
        useEffect(() => {
            if (canSubmit) scrollClearOfBottomNav(ctaRef.current)
        }, [canSubmit])

        /**
         * Keeps the BIC in step with the IBAN and returns the derived BIC, if any.
         * An IBAN the table knows fills the field in and says so. Any other IBAN
         * (unknown bank, invalid, empty) leaves it empty and drops a BIC derived
         * from an earlier IBAN, so the form never holds a pair that does not match.
         *
         * The field stays on screen either way. A derived BIC is a lookup, not a
         * fact about this account: the tables behind it carry retired codes and
         * banks that renamed, so the person whose money it is has to be able to
         * see it and correct it.
         */
        const syncBicWithIban = async (rawIban: string): Promise<string | null> => {
            const iban = (rawIban ?? '').replace(/\s/g, '')

            // A correction belongs to the IBAN it was made for, and to no other.
            // Syncing any different IBAN drops it, so coming back to the first
            // one derives afresh instead of reusing a BIC that by then may name
            // another bank entirely. Cleared here rather than beside the
            // overwrite below so that it happens for an IBAN that derives
            // nothing too.
            if (correctedForIbanRef.current !== null && correctedForIbanRef.current !== iban) {
                correctedForIbanRef.current = null
            }

            let derivedBic: string | null = null
            if (iban && (await validateIban(iban))) {
                try {
                    derivedBic = (await getBicFromIban(iban)) || null
                } catch {
                    // The lookup FAILED, which is not "the table does not know
                    // this bank". A BIC already derived for this same IBAN is
                    // still right; dropping it made a network blip at submit
                    // demand a BIC by hand from a user who never saw the field.
                    derivedBic = derivedForIbanRef.current === iban ? derivedBicRef.current : null
                }
            }

            if (derivedBic) {
                // The user corrected this IBAN's BIC, so ours lost. Re-deriving
                // runs again at submit, and without this it would overwrite the
                // correction with the value they had just rejected.
                if (correctedForIbanRef.current === iban) {
                    return (getValues('bic') ?? '').trim() || null
                }
                derivedBicRef.current = derivedBic
                derivedForIbanRef.current = iban
                setValue('bic', derivedBic, { shouldValidate: true })
                setBicAutoFilled(true)
                return derivedBic
            }

            if (derivedBicRef.current !== null && getValues('bic') === derivedBicRef.current) {
                setValue('bic', '', { shouldValidate: true })
            }
            derivedBicRef.current = null
            derivedForIbanRef.current = null
            setBicAutoFilled(false)
            return null
        }

        const onSubmit = async (data: IBankAccountDetails) => {
            // If validation is still running, don't proceed
            if (isValidating) {
                console.log('Validation still checking, skipping submission')
                return
            }

            // Clear any existing submission errors before starting
            if (submissionError) {
                setSubmissionError(null)
            }

            setIsSubmitting(true)
            try {
                const existingAccount = savedAccounts.find(
                    (account) => account.identifier === (data.accountNumber.toLowerCase() || data.clabe.toLowerCase())
                )

                // The account already exists for the logged-in user: the withdraw
                // flow selects it and routes to review (handler owns navigation).
                // Without a handler (claim flow) submission proceeds normally —
                // the old behavior pushed a claim user into the withdraw flow,
                // which dead-ended on its no-amount guard.
                if (existingAccount && onExistingAccount) {
                    onExistingAccount(existingAccount)
                    return
                }

                if (!corridor) throw new Error(t('unsupportedCountry'))
                const accountType = corridor.accountType
                const accountNumber = data[corridor.accountField]

                // split accountOwnerName into first and last name for all flows
                // note: bridge api requires both first_name and last_name for individual accounts,
                // so we validate that accountOwnerName contains at least 2 words in the form
                let firstName: string
                let lastName: string

                if (data.accountOwnerName) {
                    // split the trimmed name into parts using one or more whitespace characters as the separator
                    // this allows to handle cases where the name has multiple parts like "Peanut Guy" or "Happy Peanut Guy"
                    const nameParts = data.accountOwnerName.trim().split(/\s+/)
                    firstName = nameParts[0] || ''
                    lastName = nameParts.slice(1).join(' ') || ''
                } else {
                    // fallback to firstName/lastName if accountOwnerName is not set (backwards compatibility)
                    firstName = data.firstName || ''
                    lastName = data.lastName || ''
                }

                const iban = data.iban || getValues('iban')

                // Enter submits without a blur, so the BIC may still belong to the
                // IBAN typed before this one. Derive again from the IBAN that is
                // about to be sent; a BIC the user typed survives only when nothing
                // derives.
                let bic = data.bic || getValues('bic')
                if (isIban) {
                    const derivedBic = await syncBicWithIban(data.accountNumber || iban || '')
                    bic = derivedBic ?? getValues('bic')
                    if (!bic) {
                        // The field was hidden until now, and the form skips the rules
                        // of a field that is not mounted, so set its error by hand.
                        setValue('bic', '', { shouldTouch: true })
                        setError('bic', { type: 'required', message: t('bicRequired') })
                        return
                    }
                }

                // uk account numbers may be 6-7 digits, pad to 8 for bridge api
                const cleanedAccountNumber = isUk
                    ? accountNumber.replace(/\s/g, '').padStart(8, '0')
                    : accountNumber.replace(/\s/g, '')

                // SEPA routes by IBAN, so the destination country must come from the
                // IBAN itself — not the country picked on the previous screen. We
                // relaxed the "IBAN must match the selected country" gate, so without
                // this a German IBAN entered under "Spain" would reach Bridge with
                // countryCode=ESP and 400. Derive all three country fields from the
                // IBAN to keep the Bridge payload internally consistent (exactly what
                // the old equality gate guaranteed, just sourced from the IBAN).
                // Single normalized IBAN source: the IBAN is entered in the
                // accountNumber field (→ cleanedAccountNumber), but fall back to the
                // separate `iban` form value so the country never derives off an empty
                // string (which would send an empty countryCode to Bridge → 400).
                const normalizedIban = isIban ? cleanedAccountNumber || (iban || '').replace(/\s/g, '') : ''
                const ibanCountryCode = isIban
                    ? getCountryCodeForWithdraw(normalizedIban.slice(0, 2).toUpperCase())
                    : ''
                const ibanCountryName = isIban ? (getCountryFromIban(normalizedIban) ?? selectedCountry) : ''
                const resolvedCountryCode = isUs ? 'USA' : isIban ? ibanCountryCode : country.toUpperCase()

                const payload: Partial<AddBankAccountPayload> = {
                    accountType,
                    accountNumber: cleanedAccountNumber,
                    countryCode: resolvedCountryCode,
                    countryName: isIban ? ibanCountryName : selectedCountry,
                    accountOwnerType: BridgeAccountOwnerType.INDIVIDUAL,
                    accountOwnerName: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                    },
                    ...(corridor.needsAddress && {
                        address: {
                            street: data.street ?? '',
                            city: data.city ?? '',
                            state: data.state ?? '',
                            postalCode: data.postalCode ?? '',
                            country: resolvedCountryCode,
                        },
                    }),
                    ...(bic && { bic }),
                }

                // The corridor names its own extra fields, so a new one needs no
                // branch here.
                for (const field of corridor.fields) {
                    const value = data[field.name]
                    if (!value) continue
                    payload[field.name] = field.normalize ? field.normalize(value) : value
                }

                const result = await onSuccess(payload as AddBankAccountPayload, {
                    ...data,
                    iban: isIban ? data.accountNumber || iban || '' : '',
                    accountNumber: isIban ? '' : data.accountNumber,
                    bic: bic,
                    sortCode: isUk ? data.sortCode : '',
                    country,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    name: data.name,
                })
                if (result.error) {
                    if (!result.silent) setSubmissionError(result.error)
                    setIsSubmitting(false)
                } else {
                    setIsSubmitting(false)
                }
            } catch (error) {
                setSubmissionError(error instanceof Error ? error.message : String(error))
            } finally {
                setIsSubmitting(false)
            }
        }

        const smartPasteKindFor = (name: keyof IBankAccountDetails): PasteFieldKind | undefined => {
            switch (name) {
                case 'clabe':
                    return 'clabe'
                case 'bic':
                    return 'bic'
                case 'routingNumber':
                    return 'routingNumber'
                case 'sortCode':
                    return 'ukSortCode'
                case 'accountNumber':
                    return isIban ? 'iban' : isUk ? 'ukAccount' : isUs ? 'usAccount' : undefined
                default:
                    return undefined
            }
        }

        // Tap-to-paste: read the clipboard, pull the payment token out of it for
        // fields that know their shape (IBAN, routing, sort code…), and drop raw
        // text into the rest. Same extractor the onPaste (Ctrl+V) path uses, so
        // both give the same result.
        const handlePasteInto = async <TName extends FieldPath<IBankAccountDetails>>(
            name: TName,
            afterChange?: (value: string) => Promise<void> | void
        ) => {
            const result = await readClipboard()
            if (!result.ok) {
                toast.info(result.reason === 'unavailable' ? t('pasteUnavailable') : t('pasteEmpty'))
                return
            }
            const kind = smartPasteKindFor(name)
            const value = (kind ? (extractPaymentValue(result.text, kind) ?? result.text) : result.text).trim()
            // The form validates on blur and a tap on the button never blurs the
            // input, so validate here and run what the field's blur runs.
            setValue(name, value as PathValue<IBankAccountDetails, TName>, {
                shouldValidate: true,
                shouldTouch: true,
                shouldDirty: true,
            })
            await afterChange?.(value)
        }

        // `label`, not `placeholder`: these strings were always field names
        // ("Account Owner Name", "BIC", "Sort Code"), so as placeholders they
        // vanished the moment the user typed and left six identical grey boxes
        // with no way to tell IBAN from BIC on review.
        const renderInput = <TName extends FieldPath<IBankAccountDetails>>(
            name: TName,
            label: string,
            rules: RegisterOptions<IBankAccountDetails, TName>,
            type: string = 'text',
            rightAdornment?: React.ReactNode,
            onBlur?: (value: string) => Promise<void> | void,
            showCharCount?: boolean,
            maxLength?: number,
            helper?: string
        ) => {
            const smartPasteKind = smartPasteKindFor(name)
            // A tap-to-paste icon on every field except the char-count ones (the
            // address lines), whose trailing slot is already taken by the counter.
            const showPaste = !showCharCount
            return (
                <Field
                    label={label}
                    htmlFor={`bank-${name}`}
                    helper={helper}
                    error={errors[name] && touchedFields[name] ? (errors[name]?.message ?? '') : undefined}
                >
                    <div className="relative">
                        <Controller
                            name={name}
                            control={control}
                            rules={rules}
                            render={({ field }) => (
                                <>
                                    <BaseInput
                                        {...field}
                                        id={`bank-${name}`}
                                        type={type}
                                        onPaste={
                                            smartPasteKind
                                                ? createSmartPasteHandler(smartPasteKind, field.onChange)
                                                : undefined
                                        }
                                        className={twMerge('text-body-s', showPaste && 'pr-12')}
                                        onBlur={async (_e) => {
                                            // remove any whitespace from the input field
                                            // note: @dev not a great fix, this should also be fixed in the backend
                                            if (typeof field.value === 'string') {
                                                field.onChange(field.value.trim())
                                            }
                                            field.onBlur()
                                            if (onBlur) {
                                                await onBlur(typeof field.value === 'string' ? field.value.trim() : '')
                                            }
                                        }}
                                        rightContent={
                                            showCharCount && maxLength ? (
                                                <span className="text-body-xs">
                                                    {field.value?.length ?? 0}/{maxLength}
                                                </span>
                                            ) : undefined
                                        }
                                    />
                                    {showPaste && (
                                        <div className="absolute top-1/2 right-1 -translate-y-1/2">
                                            <Button
                                                type="button"
                                                variant="transparent"
                                                size="small"
                                                shape="square"
                                                icon="paste"
                                                iconSize={20}
                                                aria-label={t('pasteAria')}
                                                title={t('pasteAria')}
                                                onClick={() => void handlePasteInto(name, onBlur)}
                                                // the base `w-full` utility beats `.btn-square`
                                                className="w-10 text-foreground-secondary"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        />
                    </div>
                </Field>
            )
        }

        const renderSelect = (
            name: keyof IBankAccountDetails,
            label: string,
            placeholder: string,
            options: BaseSelectOption[],
            rules: RegisterOptions<IBankAccountDetails>
        ) => (
            // the trigger is a button, so htmlFor cannot name it — aria-label does
            <Field
                label={label}
                error={errors[name] && touchedFields[name] ? (errors[name]?.message ?? '') : undefined}
            >
                <Controller
                    name={name}
                    control={control}
                    rules={rules}
                    render={({ field }) => (
                        <BaseSelect
                            options={options}
                            aria-label={label}
                            placeholder={placeholder}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            className="h-12 w-full rounded-sm text-body-s"
                        />
                    )}
                />
            </Field>
        )

        const countryCodeForFlag = useMemo(() => {
            return ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.toUpperCase()] ?? country.toUpperCase()
        }, [country])

        return (
            <div className="my-auto flex h-full w-full flex-col justify-center gap-4 pb-4">
                {(flow !== 'withdraw' || amountDisplay) && (
                    <PeanutActionDetailsCard
                        countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                        avatarSize="small"
                        transactionType={'WITHDRAW_BANK_ACCOUNT'}
                        recipientType={'BANK_ACCOUNT'}
                        recipientName={country}
                        amount={amountDisplay ?? ''}
                        tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                        {...actionDetailsProps}
                        // after the spread: the flow-guarded value stays authoritative even
                        // though actionDetailsProps is a Partial of the card's full props
                        isFromSendFlow={framedAsSend}
                    />
                )}

                <div className="flex flex-col gap-4">
                    <h3 className="text-heading-card text-foreground-primary">{t('heading')}</h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSubmit(onSubmit)()
                        }}
                        className="flex flex-col gap-4"
                    >
                        {/* CLAIM FLOW: show name field for guest users or logged-in users without fullName */}
                        {flow === 'claim' && !user?.user.userId && (
                            <div className="w-full">
                                {renderInput('accountOwnerName', t('accountOwnerName'), {
                                    required: t('accountOwnerNameRequired'),
                                    validate: (value: string | undefined) => {
                                        const trimmed = value?.trim() ?? ''
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return t('accountOwnerNameFull')
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}
                        {flow === 'claim' && user?.user.userId && !user.user.fullName && (
                            <div className="w-full">
                                {renderInput('accountOwnerName', t('accountOwnerName'), {
                                    required: t('accountOwnerNameRequired'),
                                    validate: (value: string | undefined) => {
                                        const trimmed = value?.trim() ?? ''
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return t('accountOwnerNameFull')
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}
                        {flow === 'claim' &&
                            user?.user.userId &&
                            !user.user.email &&
                            !hideEmailInput &&
                            renderInput('email', t('email'), {
                                required: t('emailRequired'),
                            })}

                        {/* WITHDRAW FLOW: always show account owner's name field (empty by default) */}
                        {flow !== 'claim' && (
                            <div className="w-full">
                                {renderInput('accountOwnerName', t('accountOwnerName'), {
                                    required: t('accountOwnerNameRequired'),
                                    validate: (value: string | undefined) => {
                                        const trimmed = value?.trim() ?? ''
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return t('accountOwnerNameFull')
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}

                        {isIban
                            ? renderInput(
                                  'accountNumber',
                                  t('iban'),
                                  {
                                      required: t('ibanRequired'),
                                      validate: async (val: string) => {
                                          const isValidIban = await validateIban(val)
                                          if (!isValidIban) return t('ibanInvalid')

                                          // SEPA routes by IBAN — the country picked on the
                                          // previous screen is cosmetic for a EUR payout. Don't
                                          // force the IBAN's country to equal the dropdown: that
                                          // false-rejected a German IBAN with Spain selected, and
                                          // blocked UK users withdrawing EUR to a GB IBAN. Gate on
                                          // actual support instead (BE allowedCountries: SEPA/US/CA).
                                          const isSupported = await validateBankAccount(val)
                                          if (!isSupported) return t('ibanUnsupported')

                                          return true
                                      },
                                  },
                                  'text',
                                  undefined,
                                  async (value) => {
                                      await syncBicWithIban(value)
                                  }
                              )
                            : corridor &&
                              renderInput(
                                  corridor.accountField,
                                  tKey(corridor.accountLabelKey),
                                  {
                                      required: tKey(corridor.accountRequiredKey),
                                      validate: (value: string) =>
                                          corridor.accountTest(value) || tKey(corridor.accountInvalidKey),
                                  },
                                  'text'
                              )}

                        {isIban &&
                            renderInput(
                                'bic',
                                t('bic'),
                                {
                                    // Always on screen: the provider rejects an IBAN
                                    // account without a BIC, and a derived one still
                                    // has to be visible to be correctable.
                                    required: t('bicRequired'),
                                    validate: async (value: string) => {
                                        if (!value || value.trim().length === 0) return t('bicRequired')
                                        // Shape first, and for a derived BIC too. A
                                        // lookup that returns something malformed must
                                        // not reach the provider unchallenged.
                                        if (!ISO_9362_BIC.test(value.trim().toUpperCase())) return t('bicInvalid')
                                        // Only validate if the value matches the debounced value (to prevent API calls on every keystroke)
                                        if (value.trim() !== debouncedBicValue?.trim()) {
                                            return true // Skip validation until debounced value is ready
                                        }

                                        setisCheckingBICValid(true)
                                        const isValid = await validateBic(value.trim())
                                        setisCheckingBICValid(false)
                                        return isValid || t('bicInvalid')
                                    },
                                },
                                'text',
                                undefined,
                                (value) => {
                                    // Once the user changes it the value is theirs: the
                                    // note goes, and re-derivation stops overwriting it.
                                    if (value.trim() && value.trim() !== derivedBicRef.current) {
                                        correctedForIbanRef.current = (getValues('accountNumber') ?? '').replace(
                                            /\s/g,
                                            ''
                                        )
                                    }
                                    setBicAutoFilled(false)
                                    if (value.length > 0 && submissionError) {
                                        setSubmissionError(null)
                                    }
                                },
                                undefined,
                                undefined,
                                // Two notes, never a refusal. The first says where a
                                // value the user did not type came from. The second
                                // flags a BIC registered in another member state than
                                // the IBAN, which is routine — Revolut issues Spanish
                                // IBANs under a Lithuanian BIC — and which the provider
                                // is the only authority on, asked by `validateBic`.
                                [
                                    bicAutoFilled ? t('bicAutoFilled') : undefined,
                                    !!bicValue && bicCountryDiffersFromIban(bicValue, getValues('accountNumber') ?? '')
                                        ? t('bicCountryMismatch')
                                        : undefined,
                                ]
                                    .filter(Boolean)
                                    .join(' ') || undefined
                            )}
                        {corridor?.fields.map((field: BankCorridorField) =>
                            field.kind === 'select' ? (
                                <div key={field.name}>
                                    {renderSelect(
                                        field.name,
                                        tKey(field.labelKey),
                                        tKey(field.labelKey),
                                        (field.options ?? []).map((option) => ({
                                            label: tKey(option.labelKey),
                                            value: option.value,
                                        })),
                                        { required: tKey(field.requiredKey) }
                                    )}
                                </div>
                            ) : (
                                <div key={field.name}>
                                    {renderInput(
                                        field.name,
                                        tKey(field.labelKey),
                                        {
                                            required: tKey(field.requiredKey),
                                            validate: (value?: string) =>
                                                !field.test ||
                                                field.test(value ?? '') ||
                                                tKey(field.invalidKey ?? field.requiredKey),
                                        },
                                        'text',
                                        undefined,
                                        undefined,
                                        undefined,
                                        undefined,
                                        field.helperKey ? tKey(field.helperKey) : undefined
                                    )}
                                </div>
                            )
                        )}

                        {corridor?.needsAddress && (
                            /* address group: pt-2 on top of the 16px gap makes
                               the 24px section step without a new heading */
                            <div className="flex flex-col gap-4 pt-2">
                                {renderInput(
                                    'street',
                                    t('streetLabel'),
                                    {
                                        required: t('streetRequired'),
                                        maxLength: {
                                            value: STREET_ADDRESS_MAX_LENGTH,
                                            message: t('streetMax'),
                                        },
                                        minLength: { value: 4, message: t('streetMin') },
                                    },
                                    'text',
                                    undefined,
                                    undefined,
                                    true,
                                    STREET_ADDRESS_MAX_LENGTH
                                )}

                                {renderInput('city', t('cityLabel'), { required: t('cityRequired') })}

                                {/* Only US/MX carry a state; SEPA/UK addresses have none, so
                                    a required empty dropdown would wall the form. */}
                                {corridor.states && corridor.states.length > 0 && (
                                    <div>
                                        {renderSelect(
                                            'state',
                                            t('stateLabel'),
                                            t('state'),
                                            corridor.states.map((state) => ({
                                                label: state.name,
                                                value: state.code,
                                            })),
                                            {
                                                required: t('stateRequired'),
                                            }
                                        )}
                                    </div>
                                )}

                                {renderInput('postalCode', t('postalCodeLabel'), {
                                    required: t('postalCodeRequired'),
                                })}
                            </div>
                        )}
                        {/*
                         * The button is the LAST child, after the error: the
                         * shell's reservation under the page clears whatever ends it.
                         */}
                        <div ref={ctaRef} className="flex flex-col gap-4" data-testid="bank-form-cta">
                            {submissionError ? (
                                <Notification priority="error">{submissionError}</Notification>
                            ) : (
                                error && <Notification priority="error">{error}</Notification>
                            )}
                            <Button
                                type="submit"
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                loading={isSubmitting || isCheckingBICValid || isValidating}
                                disabled={isSubmitting || !isValid || isCheckingBICValid || isValidating}
                            >
                                {flow === 'withdraw' ? tCommon('continue') : tWithdraw('review')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }
)

DynamicBankAccountForm.displayName = 'DynamicBankAccountForm'
