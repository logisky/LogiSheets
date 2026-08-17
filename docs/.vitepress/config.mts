import {defineConfig} from 'vitepress'

// https://vitepress.dev/reference/site-config
const HOSTNAME = 'https://docs.logisheets.com'
const OG_TITLE = 'LogiSheets — Rust + WASM spreadsheet engine'
const OG_DESC =
    'A web-based spreadsheet engine in Rust + WebAssembly that reads, edits, and writes real .xlsx (Excel) files, usable from Rust, Node.js and the browser.'
const OG_IMAGE = `${HOSTNAME}/logo/logisheets.jpg`

export default defineConfig({
    title: 'LogiSheets',
    description:
        'A web-based spreadsheet engine in Rust + WASM that reads, edits, and writes real .xlsx (Excel) files, usable from Rust, Node.js and the browser.',
    // Emit sitemap.xml so search engines can crawl every page.
    sitemap: {hostname: HOSTNAME},
    // Absolute canonical/OG urls need the deploy origin.
    head: [
        // Browser-tab favicon (reuses the nav logo image).
        ['link', {rel: 'icon', type: 'image/jpeg', href: '/logo/logisheets.jpg'}],
        [
            'meta',
            {
                name: 'keywords',
                content:
                    'spreadsheet, xlsx, excel, rust, wasm, webassembly, spreadsheet engine, formula, ooxml, javascript spreadsheet, nodejs, open source',
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
    themeConfig: {
        logo: '/logo/logisheets.jpg',
        nav: [
            {text: 'Introduction', link: '/introduction'},
            {text: 'Guide', link: '/usage'},
        ],
        sidebar: [
            {
                text: 'Introduction',
                items: [{text: 'What is LogiSheets?', link: '/introduction'}],
            },
            {
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
                    {text: 'Extend with crafts', link: '/craft/craft'},
                    {text: 'Write your own craft', link: '/craft/writing-a-craft'},
                ],
            },
        ],
        socialLinks: [
            {icon: 'github', link: 'https://github.com/logisky/LogiSheets'},
        ],
        search: {
            provider: 'local',
        },
    },
})
