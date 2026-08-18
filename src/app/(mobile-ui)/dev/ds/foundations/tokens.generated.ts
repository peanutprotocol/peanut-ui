// generated from the @theme block in src/styles/globals.css by
// scripts/generate-ds-tokens.mjs — DO NOT EDIT. run `pnpm gen:ds-tokens`.
// a jest drift test (scripts/__tests__/ds-tokens-drift.test.js) fails CI when
// this file is stale.

/** which @theme banner the token sits under: legacy palette (v3 port, do not
 * use in new code), semantic (figma-verified, use these), or v3-parity shims. */
export type TokenSection = 'legacy' | 'semantic' | 'parity'

export interface ColorToken {
    name: string
    value: string
    section: TokenSection
}

export interface TextStyle {
    name: string
    section: TokenSection
    fontSize?: string
    lineHeight?: string
    fontWeight?: string
    [modifier: string]: string | undefined
}

export interface FontToken {
    name: string
    section: TokenSection
    stack?: string
    [modifier: string]: string | undefined
}

export const COLOR_TOKENS: ColorToken[] = [
    {
        name: 'primary-1',
        value: '#ff90e8',
        section: 'legacy',
    },
    {
        name: 'primary-2',
        value: '#cc73ba',
        section: 'legacy',
    },
    {
        name: 'primary-3',
        value: '#efe4ff',
        section: 'legacy',
    },
    {
        name: 'primary-4',
        value: '#ba8bff',
        section: 'legacy',
    },
    {
        name: 'secondary-1',
        value: '#ffc900',
        section: 'legacy',
    },
    {
        name: 'secondary-2',
        value: '#e99898',
        section: 'legacy',
    },
    {
        name: 'secondary-3',
        value: '#90a8ed',
        section: 'legacy',
    },
    {
        name: 'secondary-4',
        value: '#fff4cc',
        section: 'legacy',
    },
    {
        name: 'secondary-5',
        value: '#fbeaea',
        section: 'legacy',
    },
    {
        name: 'secondary-6',
        value: '#e9eefb',
        section: 'legacy',
    },
    {
        name: 'secondary-7',
        value: '#5883ff',
        section: 'legacy',
    },
    {
        name: 'secondary-8',
        value: '#d4b6ff',
        section: 'legacy',
    },
    {
        name: 'secondary-9',
        value: '#d6e1ff',
        section: 'legacy',
    },
    {
        name: 'grey-1',
        value: '#5f646d',
        section: 'legacy',
    },
    {
        name: 'grey-2',
        value: '#e7e8e9',
        section: 'legacy',
    },
    {
        name: 'grey-3',
        value: '#faf4f0',
        section: 'legacy',
    },
    {
        name: 'grey-4',
        value: '#efeff0',
        section: 'legacy',
    },
    {
        name: 'outline-1',
        value: '#98e9ab',
        section: 'legacy',
    },
    {
        name: 'outline-2',
        value: '#ae7aff',
        section: 'legacy',
    },
    {
        name: 'outline-3',
        value: '#e99898',
        section: 'legacy',
    },
    {
        name: 'purple-1',
        value: '#ff90e8',
        section: 'legacy',
    },
    {
        name: 'purple-2',
        value: '#dc78b5',
        section: 'legacy',
    },
    {
        name: 'purple-3',
        value: '#fffae8',
        section: 'legacy',
    },
    {
        name: 'purple-4',
        value: '#ae7aff',
        section: 'legacy',
    },
    {
        name: 'purple-5',
        value: '#ede4fd',
        section: 'legacy',
    },
    {
        name: 'purple-6',
        value: '#9d7efe',
        section: 'legacy',
    },
    {
        name: 'yellow-1',
        value: '#ffc900',
        section: 'legacy',
    },
    {
        name: 'yellow-2',
        value: '#f5ff7c',
        section: 'legacy',
    },
    {
        name: 'yellow-3',
        value: '#fbfdd8',
        section: 'legacy',
    },
    {
        name: 'yellow-4',
        value: '#fae8a4',
        section: 'legacy',
    },
    {
        name: 'yellow-5',
        value: '#ffd25c',
        section: 'legacy',
    },
    {
        name: 'yellow-6',
        value: '#885b00',
        section: 'legacy',
    },
    {
        name: 'yellow-7',
        value: '#ffe6b3',
        section: 'legacy',
    },
    {
        name: 'yellow-8',
        value: '#fae184',
        section: 'legacy',
    },
    {
        name: 'yellow-9',
        value: '#fde047',
        section: 'legacy',
    },
    {
        name: 'yellow-10',
        value: '#fefce8',
        section: 'legacy',
    },
    {
        name: 'yellow-11',
        value: '#ca8a04',
        section: 'legacy',
    },
    {
        name: 'green-1',
        value: '#98e9ab',
        section: 'legacy',
    },
    {
        name: 'green-2',
        value: '#eafbee',
        section: 'legacy',
    },
    {
        name: 'teal-1',
        value: '#23a094',
        section: 'legacy',
    },
    {
        name: 'teal-3',
        value: '#00577d',
        section: 'legacy',
    },
    {
        name: 'gray-1',
        value: '#5f646d',
        section: 'legacy',
    },
    {
        name: 'gray-2',
        value: '#9ca3af',
        section: 'legacy',
    },
    {
        name: 'gray-3',
        value: '#e5e7eb',
        section: 'legacy',
    },
    {
        name: 'gray-4',
        value: '#d1d5db',
        section: 'legacy',
    },
    {
        name: 'gray-5',
        value: '#60646c',
        section: 'legacy',
    },
    {
        name: 'n-1',
        value: '#000000',
        section: 'legacy',
    },
    {
        name: 'n-2',
        value: '#161616',
        section: 'legacy',
    },
    {
        name: 'n-3',
        value: '#5f646d',
        section: 'legacy',
    },
    {
        name: 'n-4',
        value: '#e7e8e9',
        section: 'legacy',
    },
    {
        name: 'violet-3',
        value: '#6340df',
        section: 'legacy',
    },
    {
        name: 'violet-9',
        value: '#f1ebf8',
        section: 'legacy',
    },
    {
        name: 'cyan-1',
        value: '#4cccef',
        section: 'legacy',
    },
    {
        name: 'orange-1',
        value: '#fe8e3e',
        section: 'legacy',
    },
    {
        name: 'orange-2',
        value: '#ff5656',
        section: 'legacy',
    },
    {
        name: 'success-1',
        value: '#16b413',
        section: 'legacy',
    },
    {
        name: 'success-2',
        value: '#c7f9c6',
        section: 'legacy',
    },
    {
        name: 'success-3',
        value: '#29cc6a',
        section: 'legacy',
    },
    {
        name: 'success-4',
        value: '#1c6a50',
        section: 'legacy',
    },
    {
        name: 'success-5',
        value: '#88d987',
        section: 'legacy',
    },
    {
        name: 'success-6',
        value: '#ecffe9',
        section: 'legacy',
    },
    {
        name: 'success-7',
        value: '#4b8a17',
        section: 'legacy',
    },
    {
        name: 'white',
        value: '#ffffff',
        section: 'legacy',
    },
    {
        name: 'red',
        value: '#ff0000',
        section: 'legacy',
    },
    {
        name: 'kyc-red',
        value: '#c80000',
        section: 'legacy',
    },
    {
        name: 'black',
        value: '#000000',
        section: 'legacy',
    },
    {
        name: 'kyc-green',
        value: '#00c800',
        section: 'legacy',
    },
    {
        name: 'background',
        value: '#faf4f0',
        section: 'legacy',
    },
    {
        name: 'error',
        value: '#b3261e',
        section: 'legacy',
    },
    {
        name: 'error-1',
        value: '#ffd8d8',
        section: 'legacy',
    },
    {
        name: 'error-2',
        value: '#ea8282',
        section: 'legacy',
    },
    {
        name: 'error-3',
        value: '#ff4a4a',
        section: 'legacy',
    },
    {
        name: 'error-4',
        value: '#fc5555',
        section: 'legacy',
    },
    {
        name: 'error-5',
        value: '#ff3b30',
        section: 'legacy',
    },
    {
        name: 'error-6',
        value: '#ffe9e9',
        section: 'legacy',
    },
    {
        name: 'action-primary',
        value: '#ff90e8',
        section: 'semantic',
    },
    {
        name: 'action-primary-hover',
        value: '#ffa3ec',
        section: 'semantic',
    },
    {
        name: 'action-secondary',
        value: '#ffc900',
        section: 'semantic',
    },
    {
        name: 'action-ghost-hover',
        value: '#bd33a1',
        section: 'semantic',
    },
    {
        name: 'action-focus',
        value: '#2563eb',
        section: 'semantic',
    },
    {
        name: 'background-default',
        value: '#ffffff',
        section: 'semantic',
    },
    {
        name: 'background-page',
        value: '#faf4f0',
        section: 'semantic',
    },
    {
        name: 'background-disabled',
        value: '#efeff0',
        section: 'semantic',
    },
    {
        name: 'background-brand',
        value: '#ff90e8',
        section: 'semantic',
    },
    {
        name: 'background-icon-bubble-green',
        value: '#29cc6a',
        section: 'semantic',
    },
    {
        name: 'background-icon-bubble-red',
        value: '#ea8282',
        section: 'semantic',
    },
    {
        name: 'background-icon-bubble-yellow',
        value: '#ffc900',
        section: 'semantic',
    },
    {
        name: 'background-icon-bubble-gray',
        value: '#d1d5db',
        section: 'semantic',
    },
    {
        name: 'background-icon-bubble-blue',
        value: '#90a8ed',
        section: 'semantic',
    },
    {
        name: 'background-badge-attention',
        value: '#ffe6b3',
        section: 'semantic',
    },
    {
        name: 'background-badge-info',
        value: '#dbeafe',
        section: 'semantic',
    },
    {
        name: 'background-badge-error',
        value: '#ffcccc',
        section: 'semantic',
    },
    {
        name: 'background-badge-success',
        value: '#c7f9c6',
        section: 'semantic',
    },
    {
        name: 'background-badge-accent',
        value: '#dcd6ff',
        section: 'semantic',
    },
    {
        name: 'background-badge-helper',
        value: '#e7e8e9',
        section: 'semantic',
    },
    {
        name: 'foreground-primary',
        value: '#000000',
        section: 'semantic',
    },
    {
        name: 'foreground-secondary',
        value: '#5f646d',
        section: 'semantic',
    },
    {
        name: 'foreground-inverse',
        value: '#ffffff',
        section: 'semantic',
    },
    {
        name: 'foreground-error',
        value: '#ff3b30',
        section: 'semantic',
    },
    {
        name: 'foreground-over-color-primary',
        value: '#000000',
        section: 'semantic',
    },
    {
        name: 'foreground-over-color-secondary',
        value: '#00000099',
        section: 'semantic',
    },
    {
        name: 'border-default',
        value: '#161616',
        section: 'semantic',
    },
    {
        name: 'border-subtle',
        value: '#9ca3af',
        section: 'semantic',
    },
    {
        name: 'border-button',
        value: '#000000',
        section: 'semantic',
    },
    {
        name: 'border-button-secondary',
        value: '#000000',
        section: 'semantic',
    },
    {
        name: 'border-accent',
        value: '#ae7aff',
        section: 'semantic',
    },
    {
        name: 'border-error',
        value: '#ff3b30',
        section: 'semantic',
    },
    {
        name: 'border-disabled',
        value: '#e7e8e9',
        section: 'semantic',
    },
    {
        name: 'avatar-pink',
        value: '#ffd5f6',
        section: 'semantic',
    },
    {
        name: 'avatar-pink-border',
        value: '#e06ac8',
        section: 'semantic',
    },
    {
        name: 'avatar-pink-foreground',
        value: '#a42089',
        section: 'semantic',
    },
    {
        name: 'avatar-yellow',
        value: '#fae184',
        section: 'semantic',
    },
    {
        name: 'avatar-yellow-border',
        value: '#dcae01',
        section: 'semantic',
    },
    {
        name: 'avatar-yellow-foreground',
        value: '#885b00',
        section: 'semantic',
    },
    {
        name: 'avatar-orange',
        value: '#ffd3b4',
        section: 'semantic',
    },
    {
        name: 'avatar-orange-border',
        value: '#f69855',
        section: 'semantic',
    },
    {
        name: 'avatar-orange-foreground',
        value: '#b8450a',
        section: 'semantic',
    },
    {
        name: 'avatar-blue',
        value: '#dbeafe',
        section: 'semantic',
    },
    {
        name: 'avatar-blue-border',
        value: '#90a8ed',
        section: 'semantic',
    },
    {
        name: 'avatar-blue-foreground',
        value: '#2563eb',
        section: 'semantic',
    },
    {
        name: 'avatar-purple',
        value: '#dcd6ff',
        section: 'semantic',
    },
    {
        name: 'avatar-purple-border',
        value: '#ba8bff',
        section: 'semantic',
    },
    {
        name: 'avatar-purple-foreground',
        value: '#9333ea',
        section: 'semantic',
    },
    {
        name: 'avatar-red',
        value: '#ffcccc',
        section: 'semantic',
    },
    {
        name: 'avatar-red-border',
        value: '#ea8282',
        section: 'semantic',
    },
    {
        name: 'avatar-red-foreground',
        value: '#e40c0c',
        section: 'semantic',
    },
    {
        name: 'avatar-green',
        value: '#c7f9c6',
        section: 'semantic',
    },
    {
        name: 'avatar-green-border',
        value: '#29cc6a',
        section: 'semantic',
    },
    {
        name: 'avatar-green-foreground',
        value: '#3b730c',
        section: 'semantic',
    },
    {
        name: 'shadow-primary',
        value: '#000000',
        section: 'semantic',
    },
]

export const TEXT_STYLES: TextStyle[] = [
    {
        name: 'heading-big-input',
        section: 'semantic',
        fontSize: '3.25rem',
        lineHeight: '4rem',
        fontWeight: '700',
    },
    {
        name: 'heading-xl',
        section: 'semantic',
        fontSize: '2.625rem',
        lineHeight: '3rem',
        fontWeight: '800',
    },
    {
        name: 'heading-l',
        section: 'semantic',
        fontSize: '2.25rem',
        lineHeight: '2.5rem',
        fontWeight: '800',
    },
    {
        name: 'heading-m',
        section: 'semantic',
        fontSize: '1.875rem',
        lineHeight: '2.25rem',
        fontWeight: '800',
    },
    {
        name: 'heading-s',
        section: 'semantic',
        fontSize: '1.5rem',
        lineHeight: '2rem',
        fontWeight: '800',
    },
    {
        name: 'heading-xs',
        section: 'semantic',
        fontSize: '1.25rem',
        lineHeight: '1.5rem',
        fontWeight: '800',
    },
    {
        name: 'heading-card',
        section: 'semantic',
        fontSize: '1.125rem',
        lineHeight: '1.5rem',
        fontWeight: '700',
    },
    {
        name: 'body-l',
        section: 'semantic',
        fontSize: '1.125rem',
        lineHeight: '1.625rem',
        fontWeight: '400',
    },
    {
        name: 'body-m',
        section: 'semantic',
        fontSize: '1rem',
        lineHeight: '1.25rem',
        fontWeight: '500',
    },
    {
        name: 'body-m-semibold',
        section: 'semantic',
        fontSize: '1rem',
        lineHeight: '1.25rem',
        fontWeight: '600',
    },
    {
        name: 'body-s',
        section: 'semantic',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        fontWeight: '500',
    },
    {
        name: 'body-xs',
        section: 'semantic',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        fontWeight: '400',
    },
    {
        name: 'label-l',
        section: 'semantic',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        fontWeight: '700',
    },
    {
        name: 'label-m',
        section: 'semantic',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        fontWeight: '800',
    },
    {
        name: 'button-l',
        section: 'semantic',
        fontSize: '1.125rem',
        lineHeight: '1.5rem',
        fontWeight: '700',
    },
    {
        name: 'button-m',
        section: 'semantic',
        fontSize: '1rem',
        lineHeight: '1rem',
        fontWeight: '700',
    },
    {
        name: 'button-s',
        section: 'semantic',
        fontSize: '0.875rem',
        lineHeight: '0.875rem',
        fontWeight: '700',
    },
    {
        name: 'display',
        section: 'semantic',
        fontSize: '3.75rem',
    },
    {
        name: '0',
        section: 'parity',
        fontSize: '0px',
        lineHeight: '0px',
    },
    {
        name: 'sm',
        section: 'parity',
        fontSize: '0.875rem',
        lineHeight: '1.3125rem',
    },
    {
        name: '6xl',
        section: 'parity',
        fontSize: '3rem',
        lineHeight: '3.25rem',
    },
    {
        name: '7xl',
        section: 'parity',
        fontSize: '7rem',
        lineHeight: '7rem',
    },
    {
        name: '8xl',
        section: 'parity',
        fontSize: '10rem',
        lineHeight: '10rem',
    },
    {
        name: '9xl',
        section: 'parity',
        fontSize: '12rem',
        lineHeight: '0.9',
    },
    {
        name: 'h1',
        section: 'parity',
        fontSize: '3rem',
        lineHeight: '3.5rem',
        fontWeight: '800',
    },
    {
        name: 'h2',
        section: 'parity',
        fontSize: '2.25rem',
        lineHeight: '2.875rem',
        fontWeight: '800',
    },
    {
        name: 'h3',
        section: 'parity',
        fontSize: '1.875rem',
        lineHeight: '2.375rem',
        fontWeight: '800',
    },
    {
        name: 'h4',
        section: 'parity',
        fontSize: '1.5rem',
        lineHeight: '2rem',
        fontWeight: '800',
    },
    {
        name: 'h5',
        section: 'parity',
        fontSize: '1.25rem',
        lineHeight: '1.75rem',
        fontWeight: '800',
    },
    {
        name: 'h6',
        section: 'parity',
        fontSize: '1.125rem',
        lineHeight: '1.5rem',
        fontWeight: '800',
    },
    {
        name: 'h7',
        section: 'parity',
        fontSize: '1rem',
        lineHeight: '1.25rem',
        fontWeight: '800',
    },
    {
        name: 'h8',
        section: 'parity',
        fontSize: '0.875rem',
        lineHeight: '1rem',
        fontWeight: '800',
    },
    {
        name: 'h9',
        section: 'parity',
        fontSize: '0.75rem',
        lineHeight: '0.875rem',
        fontWeight: '800',
    },
    {
        name: 'h10',
        section: 'parity',
        fontSize: '0.625rem',
        lineHeight: '0.75rem',
        fontWeight: '800',
    },
    {
        name: 'headingLarge',
        section: 'parity',
        fontSize: '7rem',
        lineHeight: '6.5rem',
    },
    {
        name: 'headingMedium',
        section: 'parity',
        fontSize: '5rem',
        lineHeight: '4rem',
    },
    {
        name: 'heading',
        section: 'parity',
        fontSize: '3.75rem',
        lineHeight: '2.875rem',
    },
]

export const FONT_TOKENS: FontToken[] = [
    {
        name: 'sans',
        section: 'parity',
        stack: "var(--font-roboto), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
    },
    {
        name: 'display',
        section: 'parity',
        stack: "var(--font-sniglet), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
    },
    {
        name: 'condensed',
        section: 'parity',
        stack: 'var(--font-roboto)',
        fontVariationSettings: "'wdth' 50",
    },
    {
        name: 'weight-extraBlack',
        section: 'parity',
        stack: '1000',
    },
]

/** radius / shadow / blur / motion / spacing token groups, keyed by @theme namespace */
export const TOKEN_GROUPS: Record<string, ColorToken[]> = {
    radius: [
        {
            name: 'round',
            value: '999px',
            section: 'semantic',
        },
        {
            name: 'sm',
            value: '0.125rem',
            section: 'parity',
        },
        {
            name: '1',
            value: '0.0625rem',
            section: 'parity',
        },
    ],
    'transition-duration': [
        {
            name: 'instant',
            value: '100ms',
            section: 'semantic',
        },
        {
            name: 'fast',
            value: '200ms',
            section: 'semantic',
        },
        {
            name: 'moderate',
            value: '300ms',
            section: 'semantic',
        },
        {
            name: 'slow',
            value: '500ms',
            section: 'semantic',
        },
    ],
    ease: [
        {
            name: 'spring',
            value: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            section: 'semantic',
        },
        {
            name: 'sharp',
            value: 'cubic-bezier(0.87, 0, 0.13, 1)',
            section: 'semantic',
        },
    ],
    shadow: [
        {
            name: 'sm',
            value: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            section: 'parity',
        },
        {
            name: 'md',
            value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            section: 'parity',
        },
        {
            name: 'lg',
            value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            section: 'parity',
        },
        {
            name: 'xl',
            value: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            section: 'parity',
        },
        {
            name: '2xl',
            value: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
            section: 'parity',
        },
    ],
    blur: [
        {
            name: 'sm',
            value: '4px',
            section: 'parity',
        },
        {
            name: 'md',
            value: '12px',
            section: 'parity',
        },
        {
            name: 'lg',
            value: '16px',
            section: 'parity',
        },
        {
            name: 'xl',
            value: '24px',
            section: 'parity',
        },
        {
            name: '2xl',
            value: '40px',
            section: 'parity',
        },
        {
            name: '3xl',
            value: '64px',
            section: 'parity',
        },
    ],
    'drop-shadow': [
        {
            name: 'sm',
            value: '0 1px 1px rgb(0 0 0 / 0.05)',
            section: 'parity',
        },
        {
            name: 'md',
            value: '0 4px 3px rgb(0 0 0 / 0.07), 0 2px 2px rgb(0 0 0 / 0.06)',
            section: 'parity',
        },
        {
            name: 'lg',
            value: '0 10px 8px rgb(0 0 0 / 0.04), 0 4px 3px rgb(0 0 0 / 0.1)',
            section: 'parity',
        },
        {
            name: 'xl',
            value: '0 20px 13px rgb(0 0 0 / 0.03), 0 8px 5px rgb(0 0 0 / 0.08)',
            section: 'parity',
        },
        {
            name: '2xl',
            value: '0 25px 25px rgb(0 0 0 / 0.15)',
            section: 'parity',
        },
    ],
    'default-transition': [
        {
            name: 'duration',
            value: '200ms',
            section: 'parity',
        },
        {
            name: 'timing-function',
            value: 'linear',
            section: 'parity',
        },
    ],
    animate: [
        {
            name: 'pulsate',
            value: 'pulsate 1.5s ease-in-out infinite',
            section: 'parity',
        },
        {
            name: 'pulse-strong',
            value: 'pulse-strong 1s ease-in-out infinite',
            section: 'parity',
        },
        {
            name: 'blink',
            value: 'blink 1.5s step-end infinite',
            section: 'parity',
        },
        {
            name: 'accordion-down',
            value: 'accordion-down 0.3s cubic-bezier(0.87, 0, 0.13, 1)',
            section: 'parity',
        },
        {
            name: 'accordion-up',
            value: 'accordion-up 0.3s cubic-bezier(0.87, 0, 0.13, 1)',
            section: 'parity',
        },
        {
            name: 'star-pulsate-wiggle',
            value: 'starPulsateWiggle 10s ease-in-out infinite',
            section: 'parity',
        },
    ],
}
