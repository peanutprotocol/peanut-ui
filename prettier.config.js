module.exports = {
    plugins: ['prettier-plugin-tailwindcss'],
    trailingComma: 'es5',
    tabWidth: 4,
    semi: false,
    singleQuote: true,
    printWidth: 120,
    importOrder: [
        'use client',
        '^react$',
        '<THIRD_PARTY_MODULES>',
        '^components',
        '^(store)|^(context)|^(utils$)|(^assets$)|(^consts$)|(^hooks$)|(^config$)',
        '^[./]',
    ],
}
