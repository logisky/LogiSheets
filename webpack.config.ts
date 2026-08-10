import * as path from 'path'
import * as fs from 'fs'
import {Configuration, ProvidePlugin, DefinePlugin} from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import 'webpack-dev-server'

// Which crafts the panel offers is driven by crafts.config.json + the
// CRAFT_DIST env var (default: "default"), so a single config selects the set
// for the web build, the desktop bundle, and dev. See crafts.config.json.
function resolveCraftTools(): {tools: {label: string; value: string}[]; defaultCraft: string} {
    const cfg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'crafts.config.json'), 'utf8')
    )
    const name = process.env.CRAFT_DIST || 'default'
    const dist = cfg.distributions[name] ?? cfg.distributions.default
    const dirs: string[] =
        dist.crafts === 'all' ? Object.keys(cfg.registry) : dist.crafts
    const tools = dirs.map((d: string) => ({
        label: cfg.registry[d].label as string,
        value: `/${d}/index.html`,
    }))
    const defaultCraft = dist.defaultCraft
        ? `/${dist.defaultCraft}/index.html`
        : tools[0]?.value ?? '/factory-simulator-en/index.html'
    return {tools, defaultCraft}
}

module.exports = (env: NodeJS.ProcessEnv): Configuration => {
    const craft = resolveCraftTools()
    return {
        entry: './src/index.tsx',
        mode: 'development',
        target: 'web',
        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname) + '/dist',
        },
        performance: {
            hints: false,
            maxAssetSize: 512000,
            maxEntrypointSize: 512000,
        },
        devServer: {
            static: [
                {
                    directory: path.join(__dirname, 'public'),
                },
                {
                    directory: path.join(__dirname, 'packages/engine/dist'),
                    publicPath: '/',
                },
            ],
            compress: false,
            hot: true,
            port: Number(process.env.PORT) || 4200,
        },
        experiments: {
            asyncWebAssembly: true,
            syncWebAssembly: true,
        },
        // Don't bundle initWasm from logisheets-web - it's handled by logisheets-engine's worker
        externals: {
            'logisheets-web/wasm': 'commonjs logisheets-web/wasm',
        },

        // Enable sourcemaps for debugging webpack's output.
        devtool: 'source-map',

        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: ['.ts', '.tsx', '.js', '.json', '.d.ts'],
            alias: {
                '@': path.resolve(__dirname, 'src'),
                // Exact ($) so it doesn't swallow subpath imports below.
                'logisheets-formula-editor$': path.resolve(
                    __dirname,
                    'packages/formula-editor/src/lib/index.ts'
                ),
                'logisheets-formula-editor/inline': path.resolve(
                    __dirname,
                    'packages/formula-editor/src/lib/inline.ts'
                ),
            },
        },
        plugins: [
            new ForkTsCheckerWebpackPlugin({
                typescript: {configFile: './tsconfig.json'},
            }),
            new HtmlWebpackPlugin({
                publicPath: '/',
                template: path.resolve(__dirname, 'public/index.html'),
                favicon: path.resolve(__dirname, 'public/logo.png'),
            }),
            // https://rustwasm.github.io/wasm-pack/book/commands/build.html
            // new WasmPackPlugin({
            // 	crateDirectory: path.resolve(__dirname, 'src/wasms/server'),
            // 	extraArgs: '--mode no-install --target web',
            // 	outDir: 'pkg',
            // }),
            // new WasmPackPlugin({
            // 	crateDirectory: path.resolve(__dirname, 'src/wasms/fc'),
            // 	extraArgs: '--mode no-install --target web',
            // 	outDir: 'pkg',
            // }),
            new ProvidePlugin({
                React: 'react',
            }),
            // Inject the selected craft list + default craft (see
            // resolveCraftTools). The craft panel reads these globals instead
            // of a hardcoded array.
            new DefinePlugin({
                __CRAFT_TOOLS__: JSON.stringify(craft.tools),
                __DEFAULT_CRAFT__: JSON.stringify(craft.defaultCraft),
            }),
        ],

        module: {
            rules: [
                {
                    // The logisheets-engine lib bundle inlines its WASM as a
                    // `new URL("data:application/wasm;base64,...")`. That data
                    // URI is ~8MB; webpack's default `new URL()` asset handling
                    // tries to resolve it as a module request and overflows its
                    // parser stack ("Maximum call stack size exceeded"). Disable
                    // URL parsing for this bundle so the data URI stays as
                    // runtime code (the browser resolves the data: URL itself).
                    // Its `import` statements (e.g. echarts) are unaffected.
                    test: /logisheets-engine\.(es|umd)\.js$/,
                    parser: {url: false},
                },
                {
                    test: /\.tsx?$/,
                    loader: 'esbuild-loader',
                    options: {
                        loader: 'tsx',
                        target: 'ESNext',
                    },
                },
                {
                    test: /\.(png|jpe?g|gif|svg)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: '[name][ext]',
                    },
                },
                {
                    test: /\.css$/i,
                    use: [
                        // Creates `style` nodes from JS strings
                        'style-loader',
                        // Translates CSS into CommonJS
                        'css-loader',
                        // Compiles Sass to CSS
                        'sass-loader',
                    ],
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        // Creates `style` nodes from JS strings
                        'style-loader',
                        // Translates CSS into CommonJS
                        'css-loader',
                        // Compiles Sass to CSS
                        'sass-loader',
                    ],
                },
            ],
        },
    }
}
