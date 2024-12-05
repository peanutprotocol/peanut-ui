module.exports = {
    plugins: {
        'postcss-import': {
            resolve: (id, basedir) => {
                if (id.startsWith('@justweb3')) {
                    return require.resolve(id, { paths: [basedir] })
                }
                return id
            },
        },
        'tailwindcss/nesting': {},
        tailwindcss: {},
        autoprefixer: {},
    },
}
