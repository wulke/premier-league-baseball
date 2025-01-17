// https://jestjs.io/docs/en/configuration.html

module.exports = {
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [ '/node_modules/', '/src/ui/' ],
  coverageReports: ['json', 'text', 'lcov', 'clover', 'html' ],
  globalSetup: './test/setup.ts',
  globalTeardown: './test/teardown.ts',
  moduleNameWrapper: {
    '^react$': 'preact/compat',
    '^react-dom/test-utils$': 'preact/test-utils',
    '^react-dom$': 'preact/compat',
    '^react/jsx-runtime$': 'preact/jsx-runtime'
  },
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  }
}