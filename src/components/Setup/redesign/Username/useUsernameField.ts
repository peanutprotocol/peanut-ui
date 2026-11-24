'use client'

import * as Sentry from '@sentry/nextjs'
import { useLocale } from 'next-intl'
import posthog from 'posthog-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import {
    alternativeCandidates,
    checkUsernameFree,
    firstFreeName,
    freeNames,
    lookupUsername,
    randomSuggestionStart,
    suggestionCandidates,
} from '@/features/setup/username-suggestions'
import { impactHaptic, notifyHaptic } from '@/utils/haptics'
import { evaluateUsername, type UsernameKind } from './username-state'

/** Typed names wait this long after the last key before the check (dev's ValidatedInput debounce). */
const TYPED_DEBOUNCE_MS = 750
/** A roll shows "Finding an open one…" at least this long, so it reads as a roll. */
const ROLL_MIN_MS = 300
/** Candidates tried per suggestion or roll before giving up. */
const SUGGESTION_TRIES = 5
/** Chips under a taken name: show two, check at most six. */
const CHIP_COUNT = 2
const CHIP_TRIES = 6

type ValidatedSource = 'typed' | 'die' | 'chip' | 'return'
type ErrorCategory =
    | 'too_short'
    | 'too_long'
    | 'format'
    | 'refused'
    | 'taken'
    | 'invalid'
    | 'unexpected_status'
    | 'network'
const INVALID_EVENT_TYPES: readonly ErrorCategory[] = ['too_short', 'too_long', 'format']

const validated = (source: ValidatedSource, isValid: boolean, errorType?: 'taken' | 'invalid') =>
    posthog.capture(ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED, {
        is_valid: isValid,
        ...(errorType && { error_type: errorType }),
        source,
    })

/**
 * The username field's state on 02: the checked first suggestion, the die, typed names with their rules and the
 * debounced availability check, the chips under a taken name, and the return to a name already in the flow.
 * Analytics never carry a name (contract § 6.1).
 */
export function useUsernameField() {
    const locale = useLocale()
    const { username, setUsername, refusedUsername, setRefusedUsername } = useSetupFlowContext()
    const { track, trackOnce, trackError } = useSignupControl()

    const returning = useRef(username)
    const [value, setValue] = useState(username)
    const [kind, setKind] = useState<UsernameKind>(() =>
        username ? evaluateUsername(username, refusedUsername) : 'default'
    )
    const [suggestion, setSuggestion] = useState('')
    const [suggestionRolled, setSuggestionRolled] = useState(false)
    const [alternatives, setAlternatives] = useState<string[]>([])
    const [rollFrom, setRollFrom] = useState('')
    const [rolls, setRolls] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Every new value, roll or chip takes a token; a late answer for an older token is dropped.
    const token = useRef(0)
    const timer = useRef<ReturnType<typeof setTimeout>>()
    const cursor = useRef(randomSuggestionStart())
    const lastError = useRef<ErrorCategory | null>(null)

    const nextToken = () => {
        clearTimeout(timer.current)
        token.current += 1
        return token.current
    }

    const reportError = useCallback(
        (category: ErrorCategory | null) => {
            if (lastError.current === category) return
            lastError.current = category
            trackError('username', category)
            if (category && INVALID_EVENT_TYPES.includes(category))
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_USERNAME_INVALID, { error_type: category })
        },
        [trackError]
    )

    // The categories a value shows at once; too_short waits for the debounce, network results report themselves.
    const reportKind = (shown: UsernameKind) => {
        if (shown === 'invalid-start' || shown === 'invalid-chars') reportError('format')
        else if (shown === 'too-long') reportError('too_long')
        else if (shown === 'reserved') reportError('refused')
        else reportError(null)
    }

    const nextFreeSuggestion = async () => {
        let tried = 0
        const name = await firstFreeName(
            suggestionCandidates(locale, cursor.current),
            (candidate) => {
                tried += 1
                return checkUsernameFree(candidate)
            },
            SUGGESTION_TRIES
        )
        cursor.current += tried
        return name
    }

    const showTaken = (name: string, at: number) => {
        setKind('taken')
        setAlternatives([])
        reportError('taken')
        notifyHaptic('warning')
        void freeNames(alternativeCandidates(name, locale), checkUsernameFree, CHIP_COUNT, CHIP_TRIES).then((names) => {
            if (token.current === at) setAlternatives(names)
        })
    }

    const runCheck = async (name: string, source: 'typed' | 'return', at: number) => {
        const status = await lookupUsername(name)
        if (token.current !== at) return
        if (status === 404) {
            validated(source, true)
            reportError(null)
            setKind('available')
        } else if (status === 200) {
            validated(source, false, 'taken')
            showTaken(name, at)
        } else if (status === 400) {
            validated(source, false, 'invalid')
            reportError('invalid')
            setKind('reserved')
        } else {
            setKind('check-failed')
            reportError(status === null ? 'network' : 'unexpected_status')
            if (status !== null)
                Sentry.captureMessage('Unexpected status code when checking handle availability', {
                    level: 'error',
                    extra: { status, method: 'HEAD' },
                })
        }
    }

    // Arrival: a name already in the flow is checked at once; otherwise the first free suggestion fills the field.
    useEffect(() => {
        const at = nextToken()
        const name = returning.current
        if (name) {
            const first = evaluateUsername(name, refusedUsername)
            reportKind(first)
            if (first === 'checking') void runCheck(name, 'return', at)
        } else {
            void nextFreeSuggestion().then((found) => {
                if (token.current !== at || !found) return
                setSuggestion(found)
                setValue(found)
            })
        }
        return () => {
            token.current += 1
            clearTimeout(timer.current)
        }
        // Mount only: later changes go through the handlers below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Back from 03's taken screen (or a taken name on return): the field takes focus with the caret at the end.
    useEffect(() => {
        if (kind !== 'taken' || !returning.current || value !== returning.current) return
        const input = inputRef.current
        if (!input) return
        input.focus({ preventScroll: true })
        input.setSelectionRange(value.length, value.length)
        returning.current = ''
    }, [kind, value])

    const onInput = (raw: string) => {
        // A pasted name keeps no outer spaces or "@" (the field draws its own), as 04 does (review R2-11). Spaces
        // inside the name stay and get the invalid line.
        const next = raw.trim().replace(/^@/, '').toLowerCase()
        const at = nextToken()
        returning.current = ''
        trackOnce('username', 'change')
        setValue(next)
        setAlternatives([])
        setUsername(next)
        setRefusedUsername(null)
        const nextKind = evaluateUsername(next, null)
        setKind(nextKind)
        reportKind(nextKind)
        if (nextKind === 'short')
            timer.current = setTimeout(() => {
                if (token.current === at) reportError('too_short')
            }, TYPED_DEBOUNCE_MS)
        if (nextKind === 'checking')
            timer.current = setTimeout(() => void runCheck(next, 'typed', at), TYPED_DEBOUNCE_MS)
    }

    // Tapping the shown suggestion empties the field; the suggestion stays as the placeholder.
    const onFocus = () => {
        if (kind !== 'default' && kind !== 'rolled') return
        nextToken()
        setValue('')
        setKind('empty')
    }

    const onBlur = () => {
        if (kind !== 'empty' || value || !suggestion) return
        setValue(suggestion)
        setKind(suggestionRolled ? 'rolled' : 'default')
        setUsername(suggestionRolled ? suggestion : '')
    }

    const onClear = () => {
        nextToken()
        track('username_clear', 'tap')
        setValue('')
        setKind('empty')
        setAlternatives([])
        setUsername('')
        reportError(null)
        inputRef.current?.focus({ preventScroll: true })
    }

    const onRoll = async (fromClaim = false) => {
        if (kind === 'rolling') return
        // Blur first: its handler may refill an emptied field, and the roll's state below must land after it.
        inputRef.current?.blur()
        const at = nextToken()
        track('username_die', 'tap')
        impactHaptic()
        const previous = value
        const previousKind = kind
        setRollFrom(value || suggestion)
        setRolls((count) => count + 1)
        setKind('rolling')
        setAlternatives([])
        const started = Date.now()
        const found = await nextFreeSuggestion()
        const wait = ROLL_MIN_MS - (Date.now() - started)
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
        if (token.current !== at) return
        if (!found) {
            // the die offers only checked names; when none checked free, the field goes back as it was, without
            // an error line, so the die can be tapped again
            setValue(previous)
            track('username_die', 'error', 'network')
            // a name the claim just refused must not come back claimable
            if (fromClaim) return showTaken(previous, at)
            setKind(previousKind)
            // the roll cancelled a typed name's pending check, so run it again
            if (previousKind === 'checking') void runCheck(previous, 'typed', at)
            return
        }
        returning.current = ''
        setSuggestion(found)
        setSuggestionRolled(true)
        setValue(found)
        setKind('rolled')
        setUsername(found)
        setRefusedUsername(null)
        reportError(null)
        validated('die', true)
    }

    const onPickAlternative = (name: string, index: number) => {
        nextToken()
        // the chip is a DS Button, which fires its own tap haptic
        track('username_alt', 'select', String(index + 1))
        setValue(name)
        setKind('available')
        setAlternatives([])
        setUsername(name)
        setRefusedUsername(null)
        reportError(null)
        validated('chip', true)
        inputRef.current?.focus({ preventScroll: true })
    }

    /** Claim's reservation said the name is taken or refused (contract § 4.2). */
    const onClaimRefused = (result: 'taken' | 'refused' | 'invalid') => {
        // the availability check cannot see another device's hold, so a rolled name can still lose at claim;
        // roll again instead of showing a name we offered as taken
        if (result === 'taken' && kind === 'rolled') return void onRoll(true)
        const at = nextToken()
        if (result === 'taken') showTaken(value, at)
        else {
            setKind('reserved')
            reportError(result === 'refused' ? 'refused' : 'invalid')
        }
    }

    return {
        value,
        kind,
        suggestion,
        alternatives,
        rollFrom,
        rolls,
        inputRef,
        onInput,
        onFocus,
        onBlur,
        onClear,
        onRoll,
        onPickAlternative,
        onClaimRefused,
        onSupport: () => track('username_support', 'tap'),
    }
}
