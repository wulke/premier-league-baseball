// https://jestjs.io/docs/en/configuration.html

const commonConfig = {
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [ '/node_modules/', '/src/ui/' ],
  coverageReporters: ['json', 'text', 'lcov', 'clover', 'html' ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
};

module.exports = {
  projects: [
    {
      ...commonConfig,
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '**/test/db/**/*.test.ts',
        '**/test/api/**/*.test.ts',
        '**/test/bdd/**/*.test.ts'
      ],
    },
    {
      ...commonConfig,
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/test/ui/**/*.test.tsx',
        '**/test/ui/**/*.test.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/test/ui/setup.ts'],
      moduleNameMapper: {
        '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js'
      }
    }
  ]
};