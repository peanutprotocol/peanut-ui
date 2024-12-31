const { fontFamily } = require('tailwindcss/defaultTheme')
const plugin = require('tailwindcss/plugin')

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class', '[data-theme="dark"]'],
    content: ['./src/app/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                purple: {
                    1: '#FF90E8',
                    2: '#dc78b5',
                    3: '#fffae8',
                    4: '#AE7AFF',
                },
                yellow: {
                    1: '#ffc900',
                    2: '#f5ff7c',
                    3: '#fbfdd8',
                    4: '#FAE8A4',
                },
                pink: {
                    1: '#FF90E8',
                    2: '#FCD8DB',
                },
                teal: {
                    1: '#23A094',
                    2: '#75b2d7',
                    3: '#00577d',
                },
                gray: {
                    1: '#5F646D',
                    2: '#9CA3AF',
                    3: '#e5e7eb',
                    4: '#d1d5db',
                },
                n: {
                    1: '#000000',
                    2: '#161616',
                    3: '#5F646D',
                    4: '#E7E8E9',
                },
                violet: {
                    3: '#6340DF',
                    9: '#F1EBF8',
                },
                cyan: {
                    8: '#A0E6E0',
                },
                gold: {
                    3: '#FFD25C',
                },
                white: '#FFFFFF',
                red: '#FF0000',
                'kyc-red': '#C80000', // TODO: this is bad and needs to be changed
                black: '#000000',
                'kyc-green': '#00C800', // TODO: this is bad and needs to be changed
                primary: 'var(--primary-color)',
                secondary: 'var(--secondary-color)',
                background: 'var(--background-color)',
                accent: 'var(--accent-color)',
            },
            zIndex: {
                1: '1',
                2: '2',
                3: '3',
                4: '4',
                5: '5',
            },
            spacing: {
                0.25: '0.0625rem',
                0.75: '0.1875rem',
                '1.2em': '1.2em',
                4.5: '1.125rem',
                5.5: '1.375rem',
                6.5: '1.75rem',
                7.5: '1.875rem',
                8.5: '2.125rem',
                9.5: '2.375rem',
                13: '3.25rem',
                15: '3.75rem',
                17: '4.25rem',
                18: '4.5rem',
                19: '4.75rem',
                21: '5.25rem',
                22: '5.5rem',
                26: '6.5rem',
                30: '7.5rem',
                34: '8.5rem',
                38: '9.5rem',
                42: '10.5rem',
                58: '14.5rem',
                '-1.2em': '-1.2em',
                '-2.4em': '-2.4em',
                '-3.6em': '-3.6em',
            },
            transitionDuration: {
                DEFAULT: '200ms',
            },
            transitionTimingFunction: {
                DEFAULT: 'linear',
            },
            transitionProperty: {
                filter: 'filter',
            },
            keyframes: {
                loaderDots: {
                    '0%': { opacity: 1 },
                    '50%,100%': { opacity: 0.15 },
                },
                colorPulse: {
                    '0%, 100%': { backgroundColor: '#F2F3F4', boxShadow: '0 0 0px 0px color1' },
                    '50%': { backgroundColor: '#DADEDF', boxShadow: '0 0 0px 15px color2' },
                },
            },
            animation: {
                colorPulse: 'colorPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            opacity: {
                85: '.85',
                95: '.95',
            },
            borderRadius: {
                1: '0.0625rem',
            },
            fontFamily: {
                sans: ['var(--font-roboto)', ...fontFamily.sans],
                display: ['var(--font-sniglet)', ...fontFamily.sans],
                condensed: [
                    'var(--font-roboto)',
                    {
                        fontVariationSettings: '"wdth" 50',
                    },
                ],
            },
            fontSize: {
                0: ['0px', '0px'],
                sm: ['0.875rem', '1.3125rem'],
                '6xl': ['3rem', '3.25rem'],
                '7xl': ['7rem', '7rem'],
                '8xl': ['10rem', '10rem'],
                '9xl': ['12rem', '0.9'],
                h1: [
                    '3rem',
                    {
                        lineHeight: '3.5rem',
                        fontWeight: '800',
                    },
                ],
                h2: [
                    '2.25rem',
                    {
                        lineHeight: '2.875rem',
                        fontWeight: '800',
                    },
                ],
                h3: [
                    '1.875rem',
                    {
                        lineHeight: '2.375rem',
                        fontWeight: '800',
                    },
                ],
                h4: [
                    '1.5rem',
                    {
                        lineHeight: '2rem',
                        fontWeight: '800',
                    },
                ],
                h5: [
                    '1.25rem',
                    {
                        lineHeight: '1.75rem',
                        fontWeight: '800',
                    },
                ],
                h6: [
                    '1.125rem',
                    {
                        lineHeight: '1.5rem',
                        fontWeight: '800',
                    },
                ],
                h7: [
                    '1rem',
                    {
                        lineHeight: '1.25rem',
                        fontWeight: '800',
                    },
                ],
                h8: [
                    '0.875rem',
                    {
                        lineHeight: '1rem',
                        fontWeight: '800',
                    },
                ],
                h9: [
                    '0.75rem',
                    {
                        lineHeight: '0.875rem',
                        fontWeight: '800',
                    },
                ],
                h10: [
                    '0.625rem',
                    {
                        lineHeight: '0.75rem',
                        fontWeight: '800',
                    },
                ],
            },
        },
    },
    plugins: [
        require('@headlessui/tailwindcss')({ prefix: 'ui' }),
        require('tailwind-scrollbar'),
        plugin(function ({ addBase, addComponents, addUtilities }) {
            addBase({
                html: {
                    '@apply text-[1rem]': {},
                },
                body: {
                    '@apply bg-background text-base antialiased dark:bg-n-2': {},
                },
            })
            addComponents({
                '.btn': {
                    '@apply disabled:bg-n-4 disabled:hover:bg-n-4/90 disabled:text-n-3 disabled:cursor-not-allowed inline-flex items-center justify-center h-13 px-5 border border-n-1 rounded-sm text-base text-n-1 fill-n-1 font-bold transition-colors':
                        // '@apply disabled:bg-n-4 disabled:hover:bg-n-4/90 disabled:text-n-3 disabled:cursor-not-allowed inline-flex items-center justify-center h-12 px-3 border-2 ring-2 ring-white shadow-md border-n-1 rounded-md text-base text-n-1 fill-n-1 font-bold transition-colors hover:bg-n-4/40 hover:text-n-1':
                        {},
                },
                '.btn svg': {
                    '@apply icon-18 fill-inherit first:mr-1.5 last:ml-1.5': {},
                },
                '.btn-transparent-light': {
                    '@apply btn border-transparent text-white fill-white hover:text-purple-1 hover:fill-purple-1': {},
                },
                '.btn-transparent-dark': {
                    '@apply btn border-transparent text-n-1 fill-n-1 hover:text-purple-1 hover:fill-purple-1 dark:text-white dark:fill-white dark:hover:text-purple-1 hover:dark:fill-purple-1':
                        {},
                },
                '.btn-purple': {
                    '@apply btn bg-purple-1 text-n-1 fill-n-1 hover:bg-purple-1/90': {},
                },
                '.btn-purple-2': {
                    '@apply btn bg-purple-3 text-n-1 fill-n-1 hover:bg-purple-3/90': {},
                },
                '.btn-yellow': {
                    '@apply btn bg-yellow-1 text-n-1 fill-n-1 hover:bg-yellow-1/90': {},
                },
                '.btn-dark': {
                    '@apply btn bg-n-1 text-white fill-white hover:bg-n-1/80 dark:bg-white/10 dark:hover:bg-white/20':
                        {},
                },
                '.btn-ghost': {
                    '@apply disabled:bg-n-4 disabled:hover:bg-n-4/90 disabled:text-n-3 disabled:cursor-not-allowed inline-flex items-center justify-center h-13 px-5 border-2 border-transparent rounded-md text-base text-n-1 fill-n-1 font-bold transition-colors duration-200 hover:border-n-1 hover:bg-n-4/25':
                        {},
                },
                '.btn-stroke': {
                    '@apply btn hover:bg-n-1 hover:text-white hover:fill-white dark:border-white dark:text-white dark:fill-white dark:hover:bg-white dark:hover:text-n-1 dark:hover:fill-n-1':
                        {},
                },
                '.btn-shadow': {
                    '@apply shadow-primary-4': {},
                },
                '.btn-square': {
                    '@apply !px-0': {},
                },
                '.btn-square svg': {
                    '@apply !ml-0 !mr-0': {},
                },
                '.btn-small': {
                    '@apply h-8 px-3 text-xs': {},
                },
                '.btn-xs': {
                    '@apply h-8 w-8 px-0 text-xs': {},
                },
                '.btn-medium': {
                    '@apply h-9 px-3 text-xs': {},
                },
                '.btn-large': {
                    '@apply h-10 px-3 text-lg': {},
                },
                '.btn-xl': {
                    '@apply w-full max-w-96 h-12 px-2 text-lg': {},
                },
                '.btn-2xl': {
                    '@apply w-full max-w-96 h-14 px-4 text-lg md:text-xl': {},
                },
                '.btn-xl-fixed': {
                    '@apply w-18 h-12 px-2 text-lg': {},
                },
                '.btn-small svg, .btn-medium svg': {
                    '@apply icon-16': {},
                },
                '.btn-square.btn-small': {
                    '@apply w-8': {},
                },
                '.btn-square.btn-medium': {
                    '@apply w-9': {},
                },
                '.label': {
                    '@apply inline-flex justify-center items-center h-6 px-3 border rounded-md text-center text-xs font-bold text-n-1':
                        {},
                },
                '.label-stroke': {
                    '@apply label border-n-1 dark:border-white dark:text-white': {},
                },
                '.label-stroke-yellow': {
                    '@apply label border-yellow-1 text-yellow-1': {},
                },
                '.label-stroke-pink': {
                    '@apply label border-pink-1 text-pink-1': {},
                },
                '.label-stroke-purple': {
                    '@apply label border-purple-1 text-purple-1': {},
                },
                '.label-stroke-teal': {
                    '@apply label border-teal-1 text-teal-1': {},
                },
                '.label-purple': {
                    '@apply label border-purple-1 bg-purple-1': {},
                },
                '.label-teal': {
                    '@apply label border-teal-1 bg-teal-1': {},
                },
                '.label-yellow': {
                    '@apply label border-yellow-1 bg-yellow-1': {},
                },
                '.label-black': {
                    '@apply label border-n-1 bg-n-1 text-white dark:bg-white/10': {},
                },
                '.table-custom': {
                    '@apply table w-full border-2 border-n-1 bg-white dark:bg-n-1 dark:border-white ring-2 ring-white dark:ring-n-1 shadow-md':
                        {},
                },
                '.table-select': {
                    '@apply table-custom [&>thead>tr>*:nth-child(2)]:pl-0 [&>thead>tr>*:nth-child(1)]:w-13 [&>thead>tr>*:nth-child(1)]:px-0 [&>thead>tr>*:nth-child(1)]:text-0 [&>thead>tr>*:nth-child(1)]:text-center [&>tbody>tr>*:nth-child(2)]:pl-0 [&>tbody>tr>*:nth-child(1)]:w-13 [&>tbody>tr>*:nth-child(1)]:px-0 [&>tbody>tr>*:nth-child(1)]:text-center [&>tbody>tr>*:nth-child(1)]:text-0':
                        {},
                },
                '.th-custom': {
                    '@apply table-cell h-12 px-3 py-2 align-middle text-left first:pl-5 last:pr-5': {},
                },
                '.th-custom-skeleton': {
                    '@apply table-cell h-12 px-3 py-2 align-middle text-left': {},
                },
                '.td-custom': {
                    '@apply table-cell h-[3.875rem] px-3 py-2.5 align-middle border-t border-n-1 text-sm first:pl-5 last:pr-5 dark:border-white':
                        {},
                },
                '.td-custom-skeleton': {
                    '@apply table-cell h-[3.875rem] px-3 py-2.5 align-middle border-t border-n-1 text-sm dark:border-white':
                        {},
                },
                '.card': {
                    '@apply bg-white border border-n-1 dark:bg-n-1 max-w-[27rem] relative mx-auto w-11/12 items-center justify-center px-4 py-6 xl:w-1/2 lg:w-2/3 dark:border-white':
                        {},
                },
                '.card-head': {
                    '@apply flex justify-between items-center min-h-[4rem] px-5 py-3 border-b border-n-1 dark:border-white':
                        {},
                },
                '.card-title': {
                    '@apply p-5 border-b border-n-1 text-h6 dark:border-white': {},
                },
                '.icon-16': {
                    '@apply !w-4 !h-4': {},
                },
                '.icon-18': {
                    '@apply !w-4.5 !h-4.5': {},
                },
                '.icon-20': {
                    '@apply !w-5 !h-5': {},
                },
                '.icon-22': {
                    '@apply !w-5.5 !h-5.5': {},
                },
                '.icon-24': {
                    '@apply !w-6 !h-6': {},
                },
                '.icon-28': {
                    '@apply !w-7 !h-7': {},
                },
                '.shadow-primary-4': {
                    '@apply shadow-[0.25rem_0.25rem_0_#000000] dark:shadow-[0.25rem_0.25rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.shadow-primary-6': {
                    '@apply shadow-[0.375rem_0.375rem_0_#000000] dark:shadow-[0.375rem_0.375rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.shadow-primary-8': {
                    '@apply shadow-[0.5rem_0.5rem_0_#000000] dark:shadow-[0.5rem_0.5rem_0_rgba(255,255,255,.25)]': {},
                },
                '.shadow-secondary-4': {
                    '@apply shadow-[0.25rem_-0.25rem_0_#000000] dark:shadow-[0.25rem_-0.25rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.shadow-secondary-6': {
                    '@apply shadow-[0.375rem_-0.375rem_0_#000000] dark:shadow-[0.375rem_-0.375rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.shadow-secondary-8': {
                    '@apply shadow-[0.5rem_-0.5rem_0_#000000] dark:shadow-[0.5rem_-0.5rem_0_rgba(255,255,255,.25)]': {},
                },
                '.brutal-border': {
                    '@apply border-2 border-black': {},
                },
                '.custom-input': {
                    '@apply w-full border border-n-1 transition-colors h-12 w-full rounded-none bg-transparent bg-white px-4 text-h8 font-medium outline-none placeholder:text-sm focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1':
                        {},
                },
                '.custom-input-xs': {
                    '@apply h-8': {},
                },
                '.kyc-badge': {
                    '@apply relative flex items-center justify-center text-h10 font-normal text-black h-4 w-8 rounded-full':
                        {},
                },
            })
            addUtilities({
                '.tap-highlight-color': {
                    '-webkit-tap-highlight-color': 'rgba(0, 0, 0, 0)',
                },
            })
        }),
    ],
    variants: {
        extend: {
            filter: ['hover'],
        },
    },
}
