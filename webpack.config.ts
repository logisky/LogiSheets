import * as path from 'path'
import { Configuration, DefinePlugin } from 'webpack'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import WasmPackPlugin from '@wasm-tool/wasm-pack-plugin'
import 'webpack-dev-server'
module.exports = (env: NodeJS.ProcessEnv): Configuration => {
	const mode = env['dev'] ? 'development' : 'production'
	// standalone，开启wasm模式。非standalone，开启websocket连接后台模式
	const standAlone = !!env['stand-alone']
	return {
		entry: "./src/index.tsx",
		mode,
		output: {
			filename: "bundle.js",
			path: path.resolve(__dirname) + "/dist",
		},
		performance: {
			hints: false,
			maxAssetSize: 512000,
			maxEntrypointSize: 512000,
		},
		devServer: {
			static: {
				directory: path.join(__dirname, 'public'),
			},
			compress: false,
			hot: true,
			port: 4200,
		},
		experiments: {
			asyncWebAssembly: true,
			syncWebAssembly: true,
		},

		// Enable sourcemaps for debugging webpack's output.
		devtool: "source-map",

		resolve: {
			// Add '.ts' and '.tsx' as resolvable extensions.
			extensions: [".ts", ".tsx", ".js", ".json"],
			plugins: [
				new TsconfigPathsPlugin({
					configFile: './tsconfig.json'
				}),
			],
		},
		plugins: [
			new HtmlWebpackPlugin({
				publicPath: path.join(__dirname, 'dist'),
				template: path.resolve(__dirname, '/public/index.html')
			}),
			new DefinePlugin({
				STAND_ALONE: standAlone,
			}),
			// https://rustwasm.github.io/wasm-pack/book/commands/build.html
			new WasmPackPlugin({
				crateDirectory: path.resolve(__dirname, 'src/wasms/server'),
				extraArgs: '--mode no-install --target web --dev',
				outDir: 'pkg',
			}),
			new WasmPackPlugin({
				crateDirectory: path.resolve(__dirname, 'src/wasms/fc'),
				extraArgs: '--mode no-install --target web --dev',
				outDir: 'pkg',
			}),
		],

		module: {
			rules: [
				{ test: /\.tsx?$/, loader: "ts-loader" },

				{ enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
				{
					test: /\.s[ac]ss$/i,
					use: [
						// Creates `style` nodes from JS strings
						"style-loader",
						// Translates CSS into CommonJS
						"css-loader",
						// Compiles Sass to CSS
						"sass-loader",
					],
				},
			]
		},
	};
}