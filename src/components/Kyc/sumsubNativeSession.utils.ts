type SumsubCordovaModule = NonNullable<Window['SNSMobileSDK']>

/**
 * The instance whose native screen is current. Native code reaches JavaScript
 * through `window.SNSMobileSDK.sendEvent` (status events) and
 * `window.SNSMobileSDK.getNewAccessToken` (token refresh). The Cordova wrapper
 * routes both through one module-level reference that ANY finished launch
 * clears, including a stale one whose callback arrives after a newer launch
 * started. That silently dropped the newer session's status events and token
 * refreshes (TASK-22030). Routing here is keyed to the instance we launched.
 */
let activeInstance: SNSMobileSDKInstance | null = null

export function setActiveSumsubInstance(sumsub: SumsubCordovaModule, instance: SNSMobileSDKInstance) {
    sumsub.sendEvent = (name, data) => activeInstance?.sendEvent(name, data)
    sumsub.getNewAccessToken = () => activeInstance?.getNewAccessToken()
    activeInstance = instance
}

/** Clears the route only if it still belongs to this instance. */
export function clearActiveSumsubInstance(instance: SNSMobileSDKInstance | null) {
    if (instance && activeInstance === instance) activeInstance = null
}
