import { SUMSUB_NATIVE_THEME } from '../sumsubNativeTheme.consts'

// The native SDK ignores a key it does not know, so a typo silently leaves Sumsub's default (often
// its dark-mode colour). Keys from https://docs.sumsub.com/docs/plugins-customization.
const DOCUMENTED_COLORS = new Set([
    'navigationBarItem',
    'alertTint',
    'toolbarTint',
    'toolbarBackground',
    'backgroundCommon',
    'backgroundCritical',
    'backgroundInfo',
    'backgroundNeutral',
    'backgroundSuccess',
    'backgroundWarning',
    'bottomSheetBackground',
    'bottomSheetHandle',
    'cameraBackground',
    'cameraBackgroundOverlay',
    'cameraContent',
    'cardBorderedBackground',
    'cardPlainBackground',
    'contentCritical',
    'contentInfo',
    'contentLink',
    'contentNeutral',
    'contentStrong',
    'contentSuccess',
    'contentWarning',
    'contentWeak',
    'fieldBackground',
    'fieldBackgroundInvalid',
    'fieldBorder',
    'fieldContent',
    'fieldPlaceholder',
    'fieldTint',
    'listSelectedItemBackground',
    'listSeparator',
    'primaryButtonBackground',
    'primaryButtonBackgroundDisabled',
    'primaryButtonBackgroundHighlighted',
    'primaryButtonContent',
    'primaryButtonContentDisabled',
    'primaryButtonContentHighlighted',
    'secondaryButtonBackground',
    'secondaryButtonBackgroundDisabled',
    'secondaryButtonBackgroundHighlighted',
    'secondaryButtonContent',
    'secondaryButtonContentDisabled',
    'secondaryButtonContentHighlighted',
    'statusBarColor',
])

const DOCUMENTED_METRICS = new Set([
    'buttonHeight',
    'buttonCornerRadius',
    'buttonBorderWidth',
    'cardCornerRadius',
    'cardBorderWidth',
    'fieldHeight',
    'fieldCornerRadius',
    'fieldBorderWidth',
])

describe('SUMSUB_NATIVE_THEME', () => {
    const { colors, metrics } = SUMSUB_NATIVE_THEME.universal

    it('uses only colour keys the Sumsub plugin documents', () => {
        expect(Object.keys(colors).filter((key) => !DOCUMENTED_COLORS.has(key))).toEqual([])
    })

    it('writes every colour as #RRGGBB or #RRGGBBAA', () => {
        const invalid = Object.entries(colors).filter(([, value]) => !/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(value))
        expect(invalid).toEqual([])
    })

    it('sets every surface that carries text, so dark mode cannot leave black text on a dark default', () => {
        for (const key of [
            'backgroundCommon',
            'backgroundNeutral',
            'bottomSheetBackground',
            'cardBorderedBackground',
            'cardPlainBackground',
            'fieldBackground',
            'fieldBackgroundInvalid',
            'secondaryButtonBackground',
        ]) {
            expect(colors).toHaveProperty(key)
        }
    })

    it('uses only documented metrics, as plain numbers', () => {
        expect(Object.keys(metrics).filter((key) => !DOCUMENTED_METRICS.has(key))).toEqual([])
        expect(Object.values(metrics).every((value) => typeof value === 'number')).toBe(true)
    })
})
