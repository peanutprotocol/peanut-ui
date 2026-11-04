import type { ReactNode } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { SignupAnalyticsScreenId } from '@/features/setup/signup-analytics'
import { SignupScreenContext } from '@/features/setup/useSignupControl'

/** A step as SetupWrapper renders it: on a named sign-up screen. */
export const onSignupScreen = (screenId: SignupAnalyticsScreenId, node: ReactNode) => (
    <SignupScreenContext.Provider value={screenId}>{node}</SignupScreenContext.Provider>
)

/** Every sign-up CONTROL_USED the mock captured, as `control:action[:value]`. */
export const signupControls = (capture: jest.Mock): string[] =>
    capture.mock.calls
        .filter(([event, props]) => event === ANALYTICS_EVENTS.CONTROL_USED && props.flow === 'signup')
        .map(([, { control, action, value }]) =>
            [control, action, value].filter((part) => part !== undefined).join(':')
        )
