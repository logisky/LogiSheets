import * as path from 'path'
import { Configuration, DefinePlugin } from 'webpack'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
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
			compress: true,
			port: 4200,
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
			new DefinePlugin({
				STAND_ALONE: standAlone,
			}),
		],

		module: {
			rules: [
				// All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
				{ test: /\.tsx?$/, loader: "ts-loader" },

				// All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
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