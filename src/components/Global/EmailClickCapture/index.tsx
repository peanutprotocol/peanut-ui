'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MESSAGE_PARAM, readMessageType } from '@/utils/notification-message'
import { UTM_MEDIUMS } from '@/utils/utm.utils'
import { parseAsString, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import { useEffect } from 'react'

/**
 * Records an email click as `notification_clicked` with the message it came from: email links carry
 * `msg=<event type>` and `utm_medium=email`. A push tap is recorded by the OneSignal click listener, so a link
 * without `utm_medium=email` records nothing here. `msg` is cleared right after, so a refresh does not count the
 * click twice; the UTM tags stay for the page view. Renders nothing.
 */
const EmailClickCapture = () => {
    const [{ msg, utm_medium }, setQuery] = useQueryStates({
        [MESSAGE_PARAM]: parseAsString,
        utm_medium: parseAsString,
    })

    useEffect(() => {
        if (!msg) return
        const message = readMessageType(msg)
        if (message && utm_medium === UTM_MEDIUMS.EMAIL) {
            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_CLICKED, { msg: message, channel: UTM_MEDIUMS.EMAIL })
        }
        void setQuery({ [MESSAGE_PARAM]: null })
    }, [msg, utm_medium, setQuery])

    return null
}

export default EmailClickCapture
