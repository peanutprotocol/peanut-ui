const getDiagnostics = jest.fn()
let androidNative = true
jest.mock('@capgo/capacitor-passkey', () => ({ CapacitorPasskey: { getDiagnostics: () => getDiagnostics() } }))
jest.mock('@/utils/capacitor', () => ({ isAndroidNativeBridge: () => androidNative }))

let fields: typeof import('../passkey-failure-fields')
beforeEach(() => {
    jest.resetModules()
    getDiagnostics.mockReset()
    androidNative = true
    fields = require('../passkey-failure-fields')
})

/** A Capacitor rejection as the patched Android plugin sends it. */
const androidRejection = (message: string, name: string, nativeException?: string) =>
    Object.assign(new Error(message), { code: name, data: { name, nativeException } })

it('maps an Android rejection to its DOM name, native code and credential type, without the message', () => {
    const error = androidRejection(
        '[16] Cancelled by user.',
        'NotAllowedError',
        'android.credentials.GetCredentialException.TYPE_USER_CANCELED'
    )
    const result = fields.passkeyFailureFields(error)
    expect(result).toEqual({
        error_name: 'NotAllowedError',
        native_error_code: 'android:16',
        native_exception: 'android.credentials.GetCredentialException.TYPE_USER_CANCELED',
        device_model: undefined,
        android_version: undefined,
        play_services_version: undefined,
    })
    expect(JSON.stringify(result)).not.toContain('Cancelled by user')
})

it('reads native facts from a wrapped cause and keeps the wrapper name', () => {
    const cause = androidRejection('Native passkey request failed.', 'UnknownError', 'NoCredentialException')
    const error = Object.assign(new Error('closing'), { name: 'PasskeyRequestSettlingError', cause })
    expect(fields.passkeyFailureFields(error)).toMatchObject({
        error_name: 'PasskeyRequestSettlingError',
        native_exception: 'NoCredentialException',
    })
})

it('drops a native exception value that is not a type name', () => {
    const error = androidRejection('x', 'UnknownError', 'Error: user@example.org')
    expect(fields.passkeyFailureFields(error).native_exception).toBeUndefined()
    expect(fields.passkeyFailureFields('boom')).toMatchObject({ error_name: undefined, native_exception: undefined })
})

it('adds device model and versions after one native read per session, never the other facts', async () => {
    getDiagnostics.mockResolvedValue({
        model: 'SM-A146B',
        osVersion: '14',
        playServicesVersion: 'unknown',
        manufacturer: 'samsung',
        appVersion: '1.2.3',
        androidSdk: 34,
    })
    await fields.loadPasskeyDeviceFacts()
    await fields.loadPasskeyDeviceFacts()
    expect(getDiagnostics).toHaveBeenCalledTimes(1)
    const result = fields.passkeyFailureFields(new Error('x'))
    expect(result).toMatchObject({ device_model: 'SM-A146B', android_version: '14', play_services_version: undefined })
    expect(Object.keys(result).sort()).toEqual(
        [
            'android_version',
            'device_model',
            'error_name',
            'native_error_code',
            'native_exception',
            'play_services_version',
        ].sort()
    )
})

it('stays empty when the binary has no getDiagnostics, and off Android makes no native call', async () => {
    getDiagnostics.mockRejectedValue(new Error('not implemented'))
    await fields.loadPasskeyDeviceFacts()
    expect(fields.passkeyFailureFields(new Error('x')).device_model).toBeUndefined()

    jest.resetModules()
    getDiagnostics.mockReset()
    androidNative = false
    fields = require('../passkey-failure-fields')
    await fields.loadPasskeyDeviceFacts()
    expect(getDiagnostics).not.toHaveBeenCalled()
})
