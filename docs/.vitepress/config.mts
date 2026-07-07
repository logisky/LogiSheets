import {defineConfig} from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'LogiSheets',
    description:
        'A web-based spreadsheet engine in Rust + WASM, usable from Rust, Node.js and the browser.',
    head: [
        // Browser-tab favicon (reuses the nav logo image).
        ['link', {rel: 'icon', type: 'image/jpeg', href: '/logo/logisheets.jpg'}],
    ],
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
