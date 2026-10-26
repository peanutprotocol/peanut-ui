/**
 * The branch a native build is made from. Release builds come from main;
 * anything else is a build for testing, which shows the testing ribbon and
 * takes OTAs from its own channel. CI names the branch (GITHUB_REF_NAME,
 * or GITHUB_HEAD_REF on a pull request); a tag is a release. Locally the
 * pushed branch wins over the checkout's own name, and PEANUT_BUILD_BRANCH
 * overrides both.
 */
const { execSync } = require('child_process')

const git = (command) => {
    try {
        return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim()
    } catch {
        return ''
    }
}

function buildBranch(env = process.env) {
    if (env.PEANUT_BUILD_BRANCH !== undefined) return env.PEANUT_BUILD_BRANCH.trim()
    if (env.GITHUB_ACTIONS) {
        if (env.GITHUB_REF_TYPE === 'tag') return 'main'
        return (env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '').trim()
    }
    const upstream = git('rev-parse --abbrev-ref --symbolic-full-name @{u}')
    if (upstream) return upstream.replace(/^[^/]+\//, '')
    const local = git('rev-parse --abbrev-ref HEAD')
    return local === 'HEAD' ? '' : local
}

/** A build for testing: a known branch that is not main. */
const isTestBuild = (branch) => !!branch && branch !== 'main'

/** The branch's own Capgo channel: lowercase, dashes, within Capgo's name limit. */
const testOtaChannel = (branch) =>
    `test-${branch
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}`.slice(0, 60)

module.exports = { buildBranch, isTestBuild, testOtaChannel }
