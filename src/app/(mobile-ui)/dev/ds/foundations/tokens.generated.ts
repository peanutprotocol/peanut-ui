// generated from the @theme block in src/styles/globals.css by
// scripts/generate-ds-tokens.mjs — DO NOT EDIT. run `pnpm gen:ds-tokens`.
// a jest drift test (scripts/__tests__/ds-tokens-drift.test.js) fails CI when
// this file is stale.

/** which @theme banner the token sits under: semantic (figma-verified, use
 * these) or v3-parity shims. The legacy palette section no longer exists. */
export type TokenSection = 'semantic' | 'parity'

export interface ThemeToken {
    name: string
    value: string
    section: TokenSection
    previewClass?: string
}

export interface TextStyle {
    name: string
    section: TokenSection
    fontSize?: string
    lineHeight?: string
    fontWeight?: string
    previewClass?: string
    [modifier: string]: string | undefined
}

export interface FontToken {
    name: string
    section: TokenSection
    stack?: string
    previewClass?: string
    [modifier: string]: string | undefined
}

export const COLOR_TOKENS: ThemeToken[] = [
    {
        "name": "action-primary",
        "value": "#ff90e8",
        "section": "semantic",
        "previewClass": "bg-action-primary"
    },
    {
        "name": "action-primary-hover",
        "value": "#ffa3ec",
        "section": "semantic",
        "previewClass": "bg-action-primary-hover"
    },
    {
        "name": "action-secondary",
        "value": "#ffc900",
        "section": "semantic",
        "previewClass": "bg-action-secondary"
    },
    {
        "name": "action-ghost-hover",
        "value": "#bd33a1",
        "section": "semantic",
        "previewClass": "bg-action-ghost-hover"
    },
    {
        "name": "action-focus",
        "value": "#2563eb",
        "section": "semantic",
        "previewClass": "bg-action-focus"
    },
    {
        "name": "background-default",
        "value": "#ffffff",
        "section": "semantic",
        "previewClass": "bg-background-default"
    },
    {
        "name": "background-page",
        "value": "#faf4f0",
        "section": "semantic",
        "previewClass": "bg-background-page"
    },
    {
        "name": "background-disabled",
        "value": "#efeff0",
        "section": "semantic",
        "previewClass": "bg-background-disabled"
    },
    {
        "name": "background-brand",
        "value": "#ff90e8",
        "section": "semantic",
        "previewClass": "bg-background-brand"
    },
    {
        "name": "background-setup-hero",
        "value": "#90a8ed",
        "section": "semantic",
        "previewClass": "bg-background-setup-hero"
    },
    {
        "name": "background-icon-bubble-green",
        "value": "#29cc6a",
        "section": "semantic",
        "previewClass": "bg-background-icon-bubble-green"
    },
    {
        "name": "background-icon-bubble-red",
        "value": "#ea8282",
        "section": "semantic",
        "previewClass": "bg-background-icon-bubble-red"
    },
    {
        "name": "background-icon-bubble-yellow",
        "value": "#ffc900",
        "section": "semantic",
        "previewClass": "bg-background-icon-bubble-yellow"
    },
    {
        "name": "background-icon-bubble-gray",
        "value": "#d1d5db",
        "section": "semantic",
        "previewClass": "bg-background-icon-bubble-gray"
    },
    {
        "name": "background-icon-bubble-blue",
        "value": "#90a8ed",
        "section": "semantic",
        "previewClass": "bg-background-icon-bubble-blue"
    },
    {
        "name": "background-surface-success",
        "value": "#f4fcf8",
        "section": "semantic",
        "previewClass": "bg-background-surface-success"
    },
    {
        "name": "background-surface-error",
        "value": "#fef9f9",
        "section": "semantic",
        "previewClass": "bg-background-surface-error"
    },
    {
        "name": "background-surface-attention",
        "value": "#fffcf2",
        "section": "semantic",
        "previewClass": "bg-background-surface-attention"
    },
    {
        "name": "background-surface-info",
        "value": "#f9fbfe",
        "section": "semantic",
        "previewClass": "bg-background-surface-info"
    },
    {
        "name": "background-surface-helper",
        "value": "#fdfdfd",
        "section": "semantic",
        "previewClass": "bg-background-surface-helper"
    },
    {
        "name": "background-badge-attention",
        "value": "#ffe6b3",
        "section": "semantic",
        "previewClass": "bg-background-badge-attention"
    },
    {
        "name": "background-badge-info",
        "value": "#dbeafe",
        "section": "semantic",
        "previewClass": "bg-background-badge-info"
    },
    {
        "name": "background-badge-error",
        "value": "#ffcccc",
        "section": "semantic",
        "previewClass": "bg-background-badge-error"
    },
    {
        "name": "background-badge-success",
        "value": "#c7f9c6",
        "section": "semantic",
        "previewClass": "bg-background-badge-success"
    },
    {
        "name": "background-badge-accent",
        "value": "#dcd6ff",
        "section": "semantic",
        "previewClass": "bg-background-badge-accent"
    },
    {
        "name": "background-badge-helper",
        "value": "#e7e8e9",
        "section": "semantic",
        "previewClass": "bg-background-badge-helper"
    },
    {
        "name": "foreground-primary",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-foreground-primary"
    },
    {
        "name": "foreground-secondary",
        "value": "#5f646d",
        "section": "semantic",
        "previewClass": "bg-foreground-secondary"
    },
    {
        "name": "foreground-inverse",
        "value": "#ffffff",
        "section": "semantic",
        "previewClass": "bg-foreground-inverse"
    },
    {
        "name": "foreground-error",
        "value": "#ff3b30",
        "section": "semantic",
        "previewClass": "bg-foreground-error"
    },
    {
        "name": "foreground-attention",
        "value": "#885b00",
        "section": "semantic",
        "previewClass": "bg-foreground-attention"
    },
    {
        "name": "foreground-over-color-primary",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-foreground-over-color-primary"
    },
    {
        "name": "foreground-over-color-secondary",
        "value": "#00000099",
        "section": "semantic",
        "previewClass": "bg-foreground-over-color-secondary"
    },
    {
        "name": "border-default",
        "value": "#161616",
        "section": "semantic",
        "previewClass": "bg-border-default"
    },
    {
        "name": "border-subtle",
        "value": "#9ca3af",
        "section": "semantic",
        "previewClass": "bg-border-subtle"
    },
    {
        "name": "border-button",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-border-button"
    },
    {
        "name": "border-button-secondary",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-border-button-secondary"
    },
    {
        "name": "border-brand",
        "value": "#ff90e8",
        "section": "semantic",
        "previewClass": "bg-border-brand"
    },
    {
        "name": "border-error",
        "value": "#ff3b30",
        "section": "semantic",
        "previewClass": "bg-border-error"
    },
    {
        "name": "border-disabled",
        "value": "#e7e8e9",
        "section": "semantic",
        "previewClass": "bg-border-disabled"
    },
    {
        "name": "avatar-pink",
        "value": "#ffd5f6",
        "section": "semantic",
        "previewClass": "bg-avatar-pink"
    },
    {
        "name": "avatar-pink-border",
        "value": "#e06ac8",
        "section": "semantic",
        "previewClass": "bg-avatar-pink-border"
    },
    {
        "name": "avatar-pink-foreground",
        "value": "#a42089",
        "section": "semantic",
        "previewClass": "bg-avatar-pink-foreground"
    },
    {
        "name": "avatar-yellow",
        "value": "#fae184",
        "section": "semantic",
        "previewClass": "bg-avatar-yellow"
    },
    {
        "name": "avatar-yellow-border",
        "value": "#dcae01",
        "section": "semantic",
        "previewClass": "bg-avatar-yellow-border"
    },
    {
        "name": "avatar-yellow-foreground",
        "value": "#885b00",
        "section": "semantic",
        "previewClass": "bg-avatar-yellow-foreground"
    },
    {
        "name": "avatar-orange",
        "value": "#ffd3b4",
        "section": "semantic",
        "previewClass": "bg-avatar-orange"
    },
    {
        "name": "avatar-orange-border",
        "value": "#f69855",
        "section": "semantic",
        "previewClass": "bg-avatar-orange-border"
    },
    {
        "name": "avatar-orange-foreground",
        "value": "#b8450a",
        "section": "semantic",
        "previewClass": "bg-avatar-orange-foreground"
    },
    {
        "name": "avatar-blue",
        "value": "#dbeafe",
        "section": "semantic",
        "previewClass": "bg-avatar-blue"
    },
    {
        "name": "avatar-blue-border",
        "value": "#90a8ed",
        "section": "semantic",
        "previewClass": "bg-avatar-blue-border"
    },
    {
        "name": "avatar-blue-foreground",
        "value": "#2563eb",
        "section": "semantic",
        "previewClass": "bg-avatar-blue-foreground"
    },
    {
        "name": "avatar-purple",
        "value": "#dcd6ff",
        "section": "semantic",
        "previewClass": "bg-avatar-purple"
    },
    {
        "name": "avatar-purple-border",
        "value": "#ba8bff",
        "section": "semantic",
        "previewClass": "bg-avatar-purple-border"
    },
    {
        "name": "avatar-purple-foreground",
        "value": "#9333ea",
        "section": "semantic",
        "previewClass": "bg-avatar-purple-foreground"
    },
    {
        "name": "avatar-red",
        "value": "#ffcccc",
        "section": "semantic",
        "previewClass": "bg-avatar-red"
    },
    {
        "name": "avatar-red-border",
        "value": "#ea8282",
        "section": "semantic",
        "previewClass": "bg-avatar-red-border"
    },
    {
        "name": "avatar-red-foreground",
        "value": "#e40c0c",
        "section": "semantic",
        "previewClass": "bg-avatar-red-foreground"
    },
    {
        "name": "avatar-green",
        "value": "#c7f9c6",
        "section": "semantic",
        "previewClass": "bg-avatar-green"
    },
    {
        "name": "avatar-green-border",
        "value": "#29cc6a",
        "section": "semantic",
        "previewClass": "bg-avatar-green-border"
    },
    {
        "name": "avatar-green-foreground",
        "value": "#3b730c",
        "section": "semantic",
        "previewClass": "bg-avatar-green-foreground"
    },
    {
        "name": "shadow-primary",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-shadow-primary"
    },
    {
        "name": "gray-0",
        "value": "#ffffff",
        "section": "semantic",
        "previewClass": "bg-gray-0"
    },
    {
        "name": "gray-50",
        "value": "#faf4f0",
        "section": "semantic",
        "previewClass": "bg-gray-50"
    },
    {
        "name": "gray-100",
        "value": "#efeff0",
        "section": "semantic",
        "previewClass": "bg-gray-100"
    },
    {
        "name": "gray-200",
        "value": "#e7e8e9",
        "section": "semantic",
        "previewClass": "bg-gray-200"
    },
    {
        "name": "gray-300",
        "value": "#d1d5db",
        "section": "semantic",
        "previewClass": "bg-gray-300"
    },
    {
        "name": "gray-400",
        "value": "#9ca3af",
        "section": "semantic",
        "previewClass": "bg-gray-400"
    },
    {
        "name": "gray-600",
        "value": "#5f646d",
        "section": "semantic",
        "previewClass": "bg-gray-600"
    },
    {
        "name": "gray-700",
        "value": "#374151",
        "section": "semantic",
        "previewClass": "bg-gray-700"
    },
    {
        "name": "gray-800",
        "value": "#1f2937",
        "section": "semantic",
        "previewClass": "bg-gray-800"
    },
    {
        "name": "gray-900",
        "value": "#161616",
        "section": "semantic",
        "previewClass": "bg-gray-900"
    },
    {
        "name": "gray-950",
        "value": "#000000",
        "section": "semantic",
        "previewClass": "bg-gray-950"
    },
    {
        "name": "pink-200",
        "value": "#ffd5f6",
        "section": "semantic",
        "previewClass": "bg-pink-200"
    },
    {
        "name": "pink-500",
        "value": "#ff90e8",
        "section": "semantic",
        "previewClass": "bg-pink-500"
    },
    {
        "name": "pink-600",
        "value": "#e06ac8",
        "section": "semantic",
        "previewClass": "bg-pink-600"
    },
    {
        "name": "pink-700",
        "value": "#bd33a1",
        "section": "semantic",
        "previewClass": "bg-pink-700"
    },
    {
        "name": "pink-800",
        "value": "#a42089",
        "section": "semantic",
        "previewClass": "bg-pink-800"
    },
    {
        "name": "yellow-200",
        "value": "#fae184",
        "section": "semantic",
        "previewClass": "bg-yellow-200"
    },
    {
        "name": "yellow-400",
        "value": "#fde047",
        "section": "semantic",
        "previewClass": "bg-yellow-400"
    },
    {
        "name": "yellow-500",
        "value": "#ffc900",
        "section": "semantic",
        "previewClass": "bg-yellow-500"
    },
    {
        "name": "yellow-600",
        "value": "#dcae01",
        "section": "semantic",
        "previewClass": "bg-yellow-600"
    },
    {
        "name": "yellow-900",
        "value": "#885b00",
        "section": "semantic",
        "previewClass": "bg-yellow-900"
    },
    {
        "name": "purple-200",
        "value": "#dcd6ff",
        "section": "semantic",
        "previewClass": "bg-purple-200"
    },
    {
        "name": "purple-400",
        "value": "#ba8bff",
        "section": "semantic",
        "previewClass": "bg-purple-400"
    },
    {
        "name": "purple-500",
        "value": "#ae7aff",
        "section": "semantic",
        "previewClass": "bg-purple-500"
    },
    {
        "name": "purple-600",
        "value": "#9333ea",
        "section": "semantic",
        "previewClass": "bg-purple-600"
    },
    {
        "name": "blue-200",
        "value": "#dbeafe",
        "section": "semantic",
        "previewClass": "bg-blue-200"
    },
    {
        "name": "blue-300",
        "value": "#90a8ed",
        "section": "semantic",
        "previewClass": "bg-blue-300"
    },
    {
        "name": "blue-500",
        "value": "#5883ff",
        "section": "semantic",
        "previewClass": "bg-blue-500"
    },
    {
        "name": "blue-600",
        "value": "#2563eb",
        "section": "semantic",
        "previewClass": "bg-blue-600"
    },
    {
        "name": "green-200",
        "value": "#c7f9c6",
        "section": "semantic",
        "previewClass": "bg-green-200"
    },
    {
        "name": "green-400",
        "value": "#88d987",
        "section": "semantic",
        "previewClass": "bg-green-400"
    },
    {
        "name": "green-500",
        "value": "#29cc6a",
        "section": "semantic",
        "previewClass": "bg-green-500"
    },
    {
        "name": "green-800",
        "value": "#3b730c",
        "section": "semantic",
        "previewClass": "bg-green-800"
    },
    {
        "name": "green-900",
        "value": "#2a5309",
        "section": "semantic",
        "previewClass": "bg-green-900"
    },
    {
        "name": "red-50",
        "value": "#ffcccc",
        "section": "semantic",
        "previewClass": "bg-red-50"
    },
    {
        "name": "red-100",
        "value": "#ea8282",
        "section": "semantic",
        "previewClass": "bg-red-100"
    },
    {
        "name": "red-200",
        "value": "#fc5555",
        "section": "semantic",
        "previewClass": "bg-red-200"
    },
    {
        "name": "red-400",
        "value": "#ff3b30",
        "section": "semantic",
        "previewClass": "bg-red-400"
    },
    {
        "name": "red-500",
        "value": "#ff0000",
        "section": "semantic",
        "previewClass": "bg-red-500"
    },
    {
        "name": "red-600",
        "value": "#e40c0c",
        "section": "semantic",
        "previewClass": "bg-red-600"
    },
    {
        "name": "orange-200",
        "value": "#ffd3b4",
        "section": "semantic",
        "previewClass": "bg-orange-200"
    },
    {
        "name": "orange-400",
        "value": "#f69855",
        "section": "semantic",
        "previewClass": "bg-orange-400"
    },
    {
        "name": "orange-800",
        "value": "#b8450a",
        "section": "semantic",
        "previewClass": "bg-orange-800"
    }
]

export const TEXT_STYLES: TextStyle[] = [
    {
        "name": "heading-big-input",
        "section": "semantic",
        "previewClass": "text-heading-big-input",
        "fontSize": "3.25rem",
        "lineHeight": "4rem",
        "fontWeight": "700"
    },
    {
        "name": "heading-xl",
        "section": "semantic",
        "previewClass": "text-heading-xl",
        "fontSize": "2.625rem",
        "lineHeight": "3rem",
        "fontWeight": "800"
    },
    {
        "name": "heading-l",
        "section": "semantic",
        "previewClass": "text-heading-l",
        "fontSize": "2.25rem",
        "lineHeight": "2.5rem",
        "fontWeight": "800"
    },
    {
        "name": "heading-m",
        "section": "semantic",
        "previewClass": "text-heading-m",
        "fontSize": "1.875rem",
        "lineHeight": "2.25rem",
        "fontWeight": "800"
    },
    {
        "name": "heading-s",
        "section": "semantic",
        "previewClass": "text-heading-s",
        "fontSize": "1.5rem",
        "lineHeight": "2rem",
        "fontWeight": "800"
    },
    {
        "name": "heading-xs",
        "section": "semantic",
        "previewClass": "text-heading-xs",
        "fontSize": "1.25rem",
        "lineHeight": "1.5rem",
        "fontWeight": "800"
    },
    {
        "name": "heading-card",
        "section": "semantic",
        "previewClass": "text-heading-card",
        "fontSize": "1.125rem",
        "lineHeight": "1.5rem",
        "fontWeight": "700"
    },
    {
        "name": "body-l",
        "section": "semantic",
        "previewClass": "text-body-l",
        "fontSize": "1.125rem",
        "lineHeight": "1.625rem",
        "fontWeight": "400"
    },
    {
        "name": "body-m",
        "section": "semantic",
        "previewClass": "text-body-m",
        "fontSize": "1rem",
        "lineHeight": "1.25rem",
        "fontWeight": "500"
    },
    {
        "name": "body-m-semibold",
        "section": "semantic",
        "previewClass": "text-body-m-semibold",
        "fontSize": "1rem",
        "lineHeight": "1.25rem",
        "fontWeight": "600"
    },
    {
        "name": "body-s",
        "section": "semantic",
        "previewClass": "text-body-s",
        "fontSize": "0.875rem",
        "lineHeight": "1.25rem",
        "fontWeight": "500"
    },
    {
        "name": "body-s-semibold",
        "section": "semantic",
        "previewClass": "text-body-s-semibold",
        "fontSize": "0.875rem",
        "lineHeight": "1.25rem",
        "fontWeight": "600"
    },
    {
        "name": "body-xs",
        "section": "semantic",
        "previewClass": "text-body-xs",
        "fontSize": "0.75rem",
        "lineHeight": "1rem",
        "fontWeight": "400"
    },
    {
        "name": "label-l",
        "section": "semantic",
        "previewClass": "text-label-l",
        "fontSize": "0.875rem",
        "lineHeight": "1.25rem",
        "fontWeight": "700"
    },
    {
        "name": "label-m",
        "section": "semantic",
        "previewClass": "text-label-m",
        "fontSize": "0.75rem",
        "lineHeight": "1rem",
        "fontWeight": "800"
    },
    {
        "name": "button-l",
        "section": "semantic",
        "previewClass": "text-button-l",
        "fontSize": "1.125rem",
        "lineHeight": "1.5rem",
        "fontWeight": "700"
    },
    {
        "name": "button-m",
        "section": "semantic",
        "previewClass": "text-button-m",
        "fontSize": "1rem",
        "lineHeight": "1rem",
        "fontWeight": "700"
    },
    {
        "name": "button-s",
        "section": "semantic",
        "previewClass": "text-button-s",
        "fontSize": "0.875rem",
        "lineHeight": "0.875rem",
        "fontWeight": "700"
    },
    {
        "name": "display",
        "section": "semantic",
        "previewClass": "text-display",
        "fontSize": "3.75rem"
    },
    {
        "name": "0",
        "section": "parity",
        "previewClass": "text-0",
        "fontSize": "0px",
        "lineHeight": "0px"
    },
    {
        "name": "sm",
        "section": "parity",
        "previewClass": "text-sm",
        "fontSize": "0.875rem",
        "lineHeight": "1.3125rem"
    },
    {
        "name": "6xl",
        "section": "parity",
        "previewClass": "text-6xl",
        "fontSize": "3rem",
        "lineHeight": "3.25rem"
    },
    {
        "name": "7xl",
        "section": "parity",
        "previewClass": "text-7xl",
        "fontSize": "7rem",
        "lineHeight": "7rem"
    },
    {
        "name": "8xl",
        "section": "parity",
        "previewClass": "text-8xl",
        "fontSize": "10rem",
        "lineHeight": "10rem"
    },
    {
        "name": "9xl",
        "section": "parity",
        "previewClass": "text-9xl",
        "fontSize": "12rem",
        "lineHeight": "0.9"
    },
    {
        "name": "h1",
        "section": "parity",
        "previewClass": "text-h1",
        "fontSize": "3rem",
        "lineHeight": "3.5rem",
        "fontWeight": "800"
    },
    {
        "name": "h2",
        "section": "parity",
        "previewClass": "text-h2",
        "fontSize": "2.25rem",
        "lineHeight": "2.875rem",
        "fontWeight": "800"
    },
    {
        "name": "h3",
        "section": "parity",
        "previewClass": "text-h3",
        "fontSize": "1.875rem",
        "lineHeight": "2.375rem",
        "fontWeight": "800"
    },
    {
        "name": "h4",
        "section": "parity",
        "previewClass": "text-h4",
        "fontSize": "1.5rem",
        "lineHeight": "2rem",
        "fontWeight": "800"
    },
    {
        "name": "h5",
        "section": "parity",
        "previewClass": "text-h5",
        "fontSize": "1.25rem",
        "lineHeight": "1.75rem",
        "fontWeight": "800"
    },
    {
        "name": "h6",
        "section": "parity",
        "previewClass": "text-h6",
        "fontSize": "1.125rem",
        "lineHeight": "1.5rem",
        "fontWeight": "800"
    },
    {
        "name": "h7",
        "section": "parity",
        "previewClass": "text-h7",
        "fontSize": "1rem",
        "lineHeight": "1.25rem",
        "fontWeight": "800"
    },
    {
        "name": "h8",
        "section": "parity",
        "previewClass": "text-h8",
        "fontSize": "0.875rem",
        "lineHeight": "1rem",
        "fontWeight": "800"
    },
    {
        "name": "h9",
        "section": "parity",
        "previewClass": "text-h9",
        "fontSize": "0.75rem",
        "lineHeight": "0.875rem",
        "fontWeight": "800"
    },
    {
        "name": "h10",
        "section": "parity",
        "previewClass": "text-h10",
        "fontSize": "0.625rem",
        "lineHeight": "0.75rem",
        "fontWeight": "800"
    },
    {
        "name": "headingLarge",
        "section": "parity",
        "previewClass": "text-headingLarge",
        "fontSize": "7rem",
        "lineHeight": "6.5rem"
    },
    {
        "name": "headingMedium",
        "section": "parity",
        "previewClass": "text-headingMedium",
        "fontSize": "5rem",
        "lineHeight": "4rem"
    },
    {
        "name": "heading",
        "section": "parity",
        "previewClass": "text-heading",
        "fontSize": "3.75rem",
        "lineHeight": "2.875rem"
    },
    {
        "name": "headingSmall",
        "section": "parity",
        "previewClass": "text-headingSmall",
        "fontSize": "2.625rem",
        "lineHeight": "2.25rem"
    }
]

export const FONT_TOKENS: FontToken[] = [
    {
        "name": "sans",
        "section": "parity",
        "previewClass": "font-sans",
        "stack": "var(--font-roboto), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
    },
    {
        "name": "display",
        "section": "parity",
        "previewClass": "font-display",
        "stack": "var(--font-sniglet), ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
    },
    {
        "name": "condensed",
        "section": "parity",
        "previewClass": "font-condensed",
        "stack": "var(--font-roboto)",
        "fontVariationSettings": "'wdth' 50"
    }
]

/** radius / shadow / blur / motion / spacing token groups, keyed by @theme namespace */
export const TOKEN_GROUPS: Record<string, ThemeToken[]> = {
    "radius": [
        {
            "name": "round",
            "value": "999px",
            "section": "semantic"
        },
        {
            "name": "card",
            "value": "0.75rem",
            "section": "semantic"
        },
        {
            "name": "sm",
            "value": "0.125rem",
            "section": "parity"
        },
        {
            "name": "1",
            "value": "0.0625rem",
            "section": "parity"
        }
    ],
    "transition-duration": [
        {
            "name": "instant",
            "value": "100ms",
            "section": "semantic"
        },
        {
            "name": "fast",
            "value": "200ms",
            "section": "semantic"
        },
        {
            "name": "moderate",
            "value": "300ms",
            "section": "semantic"
        },
        {
            "name": "slow",
            "value": "500ms",
            "section": "semantic"
        },
        {
            "name": "nav-spring",
            "value": "350ms",
            "section": "semantic"
        },
        {
            "name": "nav-pop",
            "value": "250ms",
            "section": "semantic"
        }
    ],
    "ease": [
        {
            "name": "spring",
            "value": "cubic-bezier(0.34, 1.56, 0.64, 1)",
            "section": "semantic"
        },
        {
            "name": "sharp",
            "value": "cubic-bezier(0.87, 0, 0.13, 1)",
            "section": "semantic"
        },
        {
            "name": "nav-spring",
            "value": "cubic-bezier(0.34, 1.56, 0.64, 1)",
            "section": "semantic"
        },
        {
            "name": "nav-pop",
            "value": "cubic-bezier(0.34, 1.56, 0.64, 1)",
            "section": "semantic"
        }
    ],
    "spacing": [
        {
            "name": "safe-top",
            "value": "var(--safe-top, env(safe-area-inset-top, 0px))",
            "section": "semantic",
            "previewClass": "w-safe-top"
        },
        {
            "name": "safe-right",
            "value": "var(--safe-right, env(safe-area-inset-right, 0px))",
            "section": "semantic",
            "previewClass": "w-safe-right"
        },
        {
            "name": "safe-bottom",
            "value": "var(--safe-bottom, env(safe-area-inset-bottom, 0px))",
            "section": "semantic",
            "previewClass": "w-safe-bottom"
        },
        {
            "name": "safe-left",
            "value": "var(--safe-left, env(safe-area-inset-left, 0px))",
            "section": "semantic",
            "previewClass": "w-safe-left"
        }
    ],
    "shadow": [
        {
            "name": "sm",
            "value": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            "section": "parity"
        },
        {
            "name": "md",
            "value": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            "section": "parity"
        },
        {
            "name": "lg",
            "value": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
            "section": "parity"
        },
        {
            "name": "xl",
            "value": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
            "section": "parity"
        },
        {
            "name": "2xl",
            "value": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
            "section": "parity"
        }
    ],
    "blur": [
        {
            "name": "sm",
            "value": "4px",
            "section": "parity"
        },
        {
            "name": "md",
            "value": "12px",
            "section": "parity"
        },
        {
            "name": "lg",
            "value": "16px",
            "section": "parity"
        },
        {
            "name": "xl",
            "value": "24px",
            "section": "parity"
        },
        {
            "name": "2xl",
            "value": "40px",
            "section": "parity"
        },
        {
            "name": "3xl",
            "value": "64px",
            "section": "parity"
        }
    ],
    "drop-shadow": [
        {
            "name": "sm",
            "value": "0 1px 1px rgb(0 0 0 / 0.05)",
            "section": "parity"
        },
        {
            "name": "md",
            "value": "0 4px 3px rgb(0 0 0 / 0.07), 0 2px 2px rgb(0 0 0 / 0.06)",
            "section": "parity"
        },
        {
            "name": "lg",
            "value": "0 10px 8px rgb(0 0 0 / 0.04), 0 4px 3px rgb(0 0 0 / 0.1)",
            "section": "parity"
        },
        {
            "name": "xl",
            "value": "0 20px 13px rgb(0 0 0 / 0.03), 0 8px 5px rgb(0 0 0 / 0.08)",
            "section": "parity"
        },
        {
            "name": "2xl",
            "value": "0 25px 25px rgb(0 0 0 / 0.15)",
            "section": "parity"
        }
    ],
    "default-transition": [
        {
            "name": "duration",
            "value": "200ms",
            "section": "parity"
        },
        {
            "name": "timing-function",
            "value": "linear",
            "section": "parity"
        }
    ],
    "font-weight": [
        {
            "name": "extraBlack",
            "value": "1000",
            "section": "parity"
        }
    ],
    "animate": [
        {
            "name": "pulsate",
            "value": "pulsate 1.5s ease-in-out infinite",
            "section": "parity"
        },
        {
            "name": "pulse-strong",
            "value": "pulse-strong 1s ease-in-out infinite",
            "section": "parity"
        },
        {
            "name": "blink",
            "value": "blink 1.5s step-end infinite",
            "section": "parity"
        },
        {
            "name": "accordion-down",
            "value": "accordion-down 0.3s cubic-bezier(0.87, 0, 0.13, 1)",
            "section": "parity"
        },
        {
            "name": "accordion-up",
            "value": "accordion-up 0.3s cubic-bezier(0.87, 0, 0.13, 1)",
            "section": "parity"
        },
        {
            "name": "star-pulsate-wiggle",
            "value": "starPulsateWiggle 10s ease-in-out infinite",
            "section": "parity"
        },
        {
            "name": "toast-progress",
            "value": "toast-progress linear forwards",
            "section": "parity"
        }
    ]
}
