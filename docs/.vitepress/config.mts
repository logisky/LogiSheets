import {defineConfig} from 'vitepress'

// https://vitepress.dev/reference/site-config
const HOSTNAME = 'https://docs.logisheets.com'
const OG_TITLE = 'LogiSheets — Rust + WASM spreadsheet engine'
const OG_DESC =
    'A web-based spreadsheet engine in Rust + WebAssembly that reads, edits, and writes real .xlsx (Excel) files, usable from Rust, Node.js and the browser — and built as common ground for people and AI agents to work in the same document.'
// Social-card image, deliberately NOT the square nav logo: link previews crop
// to roughly 1.91:1, which a 626x626 mark survives badly. This one is 1528x462.
const OG_IMAGE = `${HOSTNAME}/logo/logisheets.jpg`

// The site's reading order. Hoisted out of `themeConfig` because buildEnd
// reuses it below to order llms-full.txt and to check llms.txt for staleness.
const SIDEBAR = [

            {
                // Concepts: what the thing is. No how-to here — that is Guide.
                text: 'Introduction',
                items: [
                    {text: 'What is LogiSheets?', link: '/introduction'},
                    {text: 'Blocks', link: '/blocks'},
                    {text: 'Crafts', link: '/craft/craft'},
                    {text: 'Putting it together', link: '/composition'},
                ],
            },
            {
                // How to actually do things.
                text: 'Guide',
                items: [
                    {
                        text: 'Read & write spreadsheets (SDK)',
                        link: '/usage',
                    },
                    {
                        text: 'Embed the spreadsheet UI (engine)',
                        link: '/engine',
                    },
                    {
                        text: 'Headless on Node (runtime)',
                        link: '/runtime',
                    },
                    {text: 'Write your own craft', link: '/craft/writing-a-craft'},
                ],
            },
            {
                // The essays. Last, and deliberately the quietest entry.
                text: 'Ideas',
                items: [
                    {text: 'Overview', link: '/ideas/'},
                    {
                        text: 'What is real AI-native?',
                        link: '/ideas/what-is-real-AI-native',
                    },
                ],
            },
        ]

export default defineConfig({
    title: 'LogiSheets',
    description:
        'A web-based spreadsheet engine in Rust + WASM that reads, edits, and writes real .xlsx (Excel) files, usable from Rust, Node.js and the browser — and built as common ground for people and AI agents to work in the same document.',
    // Emit sitemap.xml so search engines can crawl every page.
    sitemap: {hostname: HOSTNAME},
    // Absolute canonical/OG urls need the deploy origin.
    head: [
        // Browser-tab favicon (reuses the nav logo image). The square mark,
        // not the wide banner — a 1528x462 image scaled into a 16px favicon is
        // illegible.
        ['link', {rel: 'icon', type: 'image/png', href: '/logo/logo.png'}],
        [
            'meta',
            {
                name: 'keywords',
                content:
                    'spreadsheet, xlsx, excel, rust, wasm, webassembly, spreadsheet engine, formula, ooxml, javascript spreadsheet, nodejs, open source, ai agent, llm tools, mcp, agent spreadsheet',
            },
        ],
        // Site-wide Open Graph / Twitter tags. The page-varying tags
        // (og:title, og:description, og:url, canonical, …) are injected
        // per page in `transformPageData` below so every page is distinct.
        ['meta', {property: 'og:type', content: 'website'}],
        ['meta', {property: 'og:site_name', content: 'LogiSheets'}],
        ['meta', {property: 'og:image', content: OG_IMAGE}],
        ['meta', {name: 'twitter:card', content: 'summary_large_image'}],
        ['meta', {name: 'twitter:image', content: OG_IMAGE}],
    ],
    // Give every page its own canonical URL + OG/Twitter title & description,
    // derived from the page's own title and frontmatter `description`
    // (falling back to the site defaults for pages that set neither).
    transformPageData(pageData) {
        const path = pageData.relativePath
            .replace(/index\.md$/, '')
            .replace(/\.md$/, '.html')
        const url = `${HOSTNAME}/${path}`
        const title = pageData.title
            ? `${pageData.title} | LogiSheets`
            : OG_TITLE
        const description = pageData.description || OG_DESC

        pageData.frontmatter.head ??= []
        pageData.frontmatter.head.push(
            ['link', {rel: 'canonical', href: url}],
            ['meta', {property: 'og:url', content: url}],
            ['meta', {property: 'og:title', content: title}],
            ['meta', {property: 'og:description', content: description}],
            ['meta', {name: 'twitter:title', content: title}],
            ['meta', {name: 'twitter:description', content: description}]
        )
    },
    // Emit llms-full.txt: every docs page concatenated, in reading order, so an
    // LLM can ingest the whole site in one fetch. Generated rather than
    // committed — a hand-maintained copy goes stale the first time anyone adds
    // a page, which is exactly what happened to llms.txt.
    //
    // Also warns when a page is missing from llms.txt, which is the curated
    // index and stays hand-written (its per-page descriptions are the point).
    async buildEnd(siteConfig) {
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const {srcDir, outDir} = siteConfig

        const routes: string[] = []
        for (const group of SIDEBAR)
            for (const item of group.items) routes.push(item.link)

        const fileFor = (route: string) =>
            path.join(srcDir, route.endsWith('/') ? route + 'index.md' : route + '.md')

        // Pages not in the sidebar (e.g. /chart) still belong in the dump.
        const all = await fs.readdir(srcDir, {recursive: true, withFileTypes: true})
        const extras = all
            .filter((d) => d.isFile() && d.name.endsWith('.md'))
            .map((d) => path.join(d.parentPath ?? d.path, d.name))
            .filter((f) => !f.includes('.vitepress') && !f.endsWith('index.md'))
            .filter((f) => !routes.some((r) => fileFor(r) === f))

        const files = [...routes.map(fileFor), ...extras.sort()]
        const parts = [
            '# LogiSheets — full documentation',
            '',
            'Every page of https://docs.logisheets.com concatenated in reading order.',
            'Generated at build time; see llms.txt for the curated index.',
            '',
        ]
        for (const f of files) {
            const raw = await fs.readFile(f, 'utf8')
            // Drop the YAML frontmatter; its `description` is already in llms.txt.
            parts.push('\n\n---\n\n' + raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim())
        }
        await fs.writeFile(path.join(outDir, 'llms-full.txt'), parts.join('\n'), 'utf8')

        const index = await fs.readFile(path.join(outDir, 'llms.txt'), 'utf8')
        const missing = routes.filter(
            (r) => !index.includes(r.replace(/\/$/, '/') ) && !index.includes(r + '.html')
        )
        if (missing.length)
            console.warn('[llms.txt] not linked from llms.txt: ' + missing.join(', '))
    },
    themeConfig: {
        logo: '/logo/logo.png',
        nav: [
            {text: 'Introduction', link: '/introduction'},
            {text: 'Guide', link: '/usage'},
            {text: 'Ideas', link: '/ideas/'},
        ],
        sidebar: SIDEBAR,
        socialLinks: [
            {icon: 'github', link: 'https://github.com/logisky/LogiSheets'},
        ],
        search: {
            provider: 'local',
        },
    },
})
