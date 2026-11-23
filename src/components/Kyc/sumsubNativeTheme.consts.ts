/**
 * Peanut design tokens for the native Sumsub SDK (iOS and Android), passed through the Cordova
 * plugin's `withTheme()`. Dashboard appearance sets reach only the WebSDK; the native SDK takes its
 * look from this object. Values mirror the semantic tokens in `src/styles/globals.css`.
 *
 * Every colour is a single value, so it applies in light and dark mode alike: the SDK shows the
 * Peanut light look even on a phone in dark mode. That is why every surface that carries text is
 * set here; an unset background would keep its dark default under our black text.
 *
 * Format: https://docs.sumsub.com/docs/plugins-customization (TASK-25323).
 */
export const SUMSUB_NATIVE_THEME = {
    universal: {
        colors: {
            // surfaces
            backgroundCommon: '#FAF4F0', // background-page
            backgroundNeutral: '#FFFFFF', // background-default: filled cards sit white on the page
            backgroundSuccess: '#C7F9C6', // background-badge-success
            backgroundWarning: '#FFE6B3', // background-badge-attention
            backgroundCritical: '#FFCCCC', // background-badge-error
            backgroundInfo: '#DBEAFE', // background-badge-info
            bottomSheetBackground: '#FFFFFF',
            bottomSheetHandle: '#9CA3AF', // border-subtle
            cardBorderedBackground: '#FFFFFF',
            cardPlainBackground: '#FFFFFF',
            listSelectedItemBackground: '#DBEAFE', // background-selection
            listSeparator: '#E7E8E9', // border-disabled
            toolbarBackground: '#FAF4F0',
            statusBarColor: '#FAF4F0',
            // text
            contentStrong: '#000000', // foreground-primary
            contentNeutral: '#000000',
            contentWeak: '#5F646D', // foreground-secondary
            contentLink: '#000000',
            contentSuccess: '#3B730C',
            contentWarning: '#885B00', // foreground-attention
            contentCritical: '#FF3B30', // foreground-error
            contentInfo: '#2563EB', // action-focus
            navigationBarItem: '#000000',
            alertTint: '#000000',
            toolbarTint: '#000000',
            // fields: white on the page with the default border, like `.input`
            fieldBackground: '#FFFFFF',
            fieldBackgroundInvalid: '#FFFFFF',
            fieldBorder: '#161616', // border-default
            fieldContent: '#000000',
            fieldPlaceholder: '#5F646D',
            fieldTint: '#000000', // cursor and the active checkbox or radio; pink would be too faint on white
            // buttons: pink primary and white secondary, black labels; disabled is the button at 40%
            primaryButtonBackground: '#FF90E8', // action-primary
            primaryButtonBackgroundHighlighted: '#FFA3EC', // action-primary-press
            primaryButtonBackgroundDisabled: '#FF90E866',
            primaryButtonContent: '#000000',
            primaryButtonContentHighlighted: '#000000',
            primaryButtonContentDisabled: '#00000066',
            secondaryButtonBackground: '#FFFFFF',
            secondaryButtonBackgroundHighlighted: '#FF90E8', // a secondary button presses to pink
            secondaryButtonBackgroundDisabled: '#FFFFFF66',
            secondaryButtonContent: '#000000',
            secondaryButtonContentHighlighted: '#000000',
            secondaryButtonContentDisabled: '#00000066',
        },
        metrics: {
            buttonHeight: 48,
            buttonCornerRadius: 24, // a pill at 48
            buttonBorderWidth: 1, // the secondary button; Sumsub draws no border on a primary
            cardCornerRadius: 2,
            cardBorderWidth: 1,
            fieldHeight: 48,
            fieldCornerRadius: 2,
            fieldBorderWidth: 1,
        },
    },
} as const
