import { compilerOptions } from './tsconfig.json'
import { pathsToModuleNameMapper } from 'ts-jest'
import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
	verbose: true,
	silent: false,
	cache: true,
	// moduleNameMapper: {
	// 	"src/(.*)$": resolve(__dirname, './src/$1'),
	// },
	rootDir: '.',
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
	modulePaths: [
		'<rootDir>'
	],
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	}
}

export default config