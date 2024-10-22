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
                    1: '#FF90E7',
                    2: '#ffb3ee',
                    3: '#ffe3f8',
                },
                yellow: {
                    1: '#FAE8A4',
                    2: '#FEFAED',
                },
                pink: {
                    1: '#E99898',
                    2: '#FBEAEA',
                },
                green: {
                    1: '#98E9AB',
                    2: '#EAFBEE',
                },
                n: {
                    1: '#000000',
                    2: '#161616',
                    3: '#5F646D',
                    4: '#E7E8E9',
                },
                white: '#FFFFFF',
                background: '#FAF4F0',
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
            },
            transitionDuration: {
                DEFAULT: '200ms',
            },
            transitionTimingFunction: {
                DEFAULT: 'linear',
            },
            keyframes: {
                loaderDots: {
                    '0%': { opacity: 1 },
                    '50%,100%': { opacity: 0.15 },
                },
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
            },
            fontSize: {
                0: ['0px', '0px'],
                sm: ['0.875rem', '1.3125rem'],
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
                    '@apply inline-flex items-center gap-2 justify-center h-13 px-5 border border-n-1 rounded-sm text-base text-n-1 fill-n-1 font-bold transition-colors':
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
                '.btn-dark': {
                    '@apply btn bg-n-1 text-white fill-white hover:bg-n-1/80 dark:bg-white/10 dark:hover:bg-white/20':
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
                '.btn-medium': {
                    '@apply h-9 px-2 text-xs': {},
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
                    '@apply inline-flex justify-center items-center h-6 px-3 border rounded-sm text-center text-xs font-bold text-n-1':
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
                '.label-stroke-green': {
                    '@apply label border-green-1 text-green-1': {},
                },
                '.label-purple': {
                    '@apply label border-purple-1 bg-purple-1': {},
                },
                '.label-green': {
                    '@apply label border-green-1 bg-green-1': {},
                },
                '.label-yellow': {
                    '@apply label border-yellow-1 bg-yellow-1': {},
                },
                '.label-black': {
                    '@apply label border-n-1 bg-n-1 text-white dark:bg-white/10': {},
                },
                '.table-custom': {
                    '@apply table w-full border border-n-1 bg-white dark:bg-n-1 dark:border-white': {},
                },
                '.table-select': {
                    '@apply table-custom [&>thead>tr>*:nth-child(2)]:pl-0 [&>thead>tr>*:nth-child(1)]:w-13 [&>thead>tr>*:nth-child(1)]:px-0 [&>thead>tr>*:nth-child(1)]:text-0 [&>thead>tr>*:nth-child(1)]:text-center [&>tbody>tr>*:nth-child(2)]:pl-0 [&>tbody>tr>*:nth-child(1)]:w-13 [&>tbody>tr>*:nth-child(1)]:px-0 [&>tbody>tr>*:nth-child(1)]:text-center [&>tbody>tr>*:nth-child(1)]:text-0':
                        {},
                },
                '.th-custom': {
                    '@apply table-cell h-12 px-3 py-2 align-middle text-left first:pl-5 last:pr-5': {},
                },
                '.td-custom': {
                    '@apply table-cell h-[3.875rem] px-3 py-2.5 align-middle border-t border-n-1 text-sm first:pl-5 last:pr-5 dark:border-white':
                        {},
                },
                '.card': {
                    '@apply flex flex-col bg-white border border-n-1 dark:bg-n-1 relative mx-auto items-center justify-center dark:border-white':
                        {},
                },
                '.card-head': {
                    '@apply flex justify-between flex-col items-start min-h-[4rem] px-3 sm:px-5 py-3 border-b border-n-1 dark:border-white':
                        {},
                },
                '.card-content': {
                    '@apply px-3 sm:px-5 py-3 border-n-1 dark:border-white': {},
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
                '.btn-shadow-primary-4': {
                    '@apply shadow-[0.25rem_0.25rem_0_#000000] dark:shadow-[0.25rem_0.25rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.btn-shadow-primary-6': {
                    '@apply shadow-[0.375rem_0.375rem_0_#000000] dark:shadow-[0.375rem_0.375rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.btn-shadow-primary-8': {
                    '@apply shadow-[0.5rem_0.5rem_0_#000000] dark:shadow-[0.5rem_0.5rem_0_rgba(255,255,255,.25)]': {},
                },
                '.btn-shadow-secondary-4': {
                    '@apply shadow-[0.25rem_-0.25rem_0_#000000] dark:shadow-[0.25rem_-0.25rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.btn-shadow-secondary-6': {
                    '@apply shadow-[0.375rem_-0.375rem_0_#000000] dark:shadow-[0.375rem_-0.375rem_0_rgba(255,255,255,.25)]':
                        {},
                },
                '.btn-shadow-secondary-8': {
                    '@apply shadow-[0.5rem_-0.5rem_0_#000000] dark:shadow-[0.5rem_-0.5rem_0_rgba(255,255,255,.25)]': {},
                },
                '.input': {
                    '@apply h-16 w-full rounded-sm border border-n-1 bg-white px-5 text-sm font-bold text-n-1 outline-none transition-colors placeholder:text-n-3 focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1':
                        {},
                },
                '.bg-peanut-repeat-normal': {
                    '@apply bg-[url("../assets/bg/peanut-bg.svg")] bg-repeat bg-[length:100px_100px]': {},
                },
                '.bg-peanut-repeat-large': {
                    '@apply bg-[url("../assets/bg/peanut-bg.svg")] bg-repeat bg-[length:200px_200px]': {},
                },
                '.bg-peanut-repeat-small': {
                    '@apply bg-[url("../assets/bg/peanut-bg.svg")] bg-repeat bg-[length:50px_50px]': {},
                },
            })
            addUtilities({
                '.tap-highlight-color': {
                    '-webkit-tap-highlight-color': 'rgba(0, 0, 0, 0)',
                },
            })
        }),
    ],
}
