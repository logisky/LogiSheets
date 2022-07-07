import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    verbose: true,
    silent: false,
    cache: true,
    rootDir: '.',
    testEnvironment: 'node',
    collectCoverage: true,
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testMatch: [
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    moduleNameMapper: {
        '@/(.*)': '<rootDir>/src/$1',
    },
    modulePaths: [
        '<rootDir>'
    ],
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json',
        }
    }
}

export default config