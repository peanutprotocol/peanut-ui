/** @jest-environment node */

const { changesOutsidePlatform, changesUnsafeForSameVersion } = require('../check-native-change-scope.cjs')

describe('check-native-change-scope', () => {
    it('accepts only the selected platform native paths', () => {
        expect(
            changesOutsidePlatform(
                [
                    { path: 'android/app/proguard-rules.pro' },
                    { path: 'android/app/src/**.{java,kt}' },
                    { path: 'android/native-plugin-versions' },
                ],
                'android'
            )
        ).toEqual([])
    })

    it('rejects the other platform and shared native inputs', () => {
        const changes = [
            { path: 'android/app/proguard-rules.pro' },
            { path: 'ios/App/**.swift' },
            { path: 'ios/native-plugin-versions' },
            { path: 'shared/native-plugin-versions' },
        ]

        expect(changesOutsidePlatform(changes, 'android')).toEqual([
            { path: 'ios/App/**.swift' },
            { path: 'ios/native-plugin-versions' },
            { path: 'shared/native-plugin-versions' },
        ])
    })

    it('fails closed for an unknown platform', () => {
        expect(() => changesOutsidePlatform([], 'web')).toThrow('expected android or ios')
    })

    it('allows only packaging fixes for a same-version Android replacement', () => {
        expect(changesUnsafeForSameVersion([{ path: 'android/app/proguard-rules.pro' }], 'android')).toEqual([])
        expect(
            changesUnsafeForSameVersion(
                [{ path: 'android/app/proguard-rules.pro' }, { path: 'android/app/src/**.{java,kt}' }],
                'android'
            )
        ).toEqual([{ path: 'android/app/src/**.{java,kt}' }])
    })
})
