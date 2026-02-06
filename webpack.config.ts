import * as path from 'path'
import {Configuration, DefinePlugin, ProvidePlugin} from 'webpack'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import 'webpack-dev-server'
module.exports = (env: NodeJS.ProcessEnv): Configuration => {
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
            port: 4200,
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
            plugins: [
                new TsconfigPathsPlugin({
                    configFile: './tsconfig.json',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any,
            ],
        },
        plugins: [
            new DefinePlugin({
                'process.env.LOGISHEETS_API_KEY': JSON.stringify(
                    process.env.LOGISHEETS_API_KEY || ''
                ),
            }),
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
        ],

        module: {
            rules: [
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
