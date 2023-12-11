const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
    corePlugins: {
        preflight: false,
    },

    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            animation: {
                wiggle: 'wiggle 1s ease-in-out infinite',
                'spin-slow': 'spin 3s linear infinite',
                spin: 'spin 1.5s linear infinite',
            },
            minWidth: {
                25: '25px',
                50: '50px',
                75: '75px',
            },
        },
        colors: {
            transparent: 'transparent',
            current: 'currentColor',
            black: colors.black,
            white: colors.white,
            fuchsia: '#FF90E8',
            yellow: '#F1F333',
            teal: '#23A094',
            lightblue: '#90A8ED',
            red: '#E2442F',
            orange: '#FFC900',
            gray: {
                50: '#f9fafb',
                100: '#f3f4f6',
                200: '#e5e7eb',
                300: '#d1d5db',
                400: '#9ca3af',
                500: '#6b7280',
                600: '#4b5563',
                700: '#374151',
                800: '#1f2937',
                900: '#111827',
            },

            orange: {
                50: '#fff8f1',
                100: '#feecdc',
                200: '#fcd9bd',
                300: '#fdba8c',
                400: '#ff8a4c',
                500: '#ff5a1f',
                600: '#d03801',
                700: '#b43403',
                800: '#8a2c0d',
                900: '#771d1d',
            },
            green: {
                50: '#f3faf7',
                100: '#def7ec',
                200: '#bcf0da',
                300: '#84e1bc',
                400: '#31c48d',
                500: '#0e9f6e',
                600: '#057a55',
                700: '#046c4e',
                800: '#03543f',
                900: '#014737',
            },
        },
    },

    plugins: [require('daisyui')],
}
