/* eslint-disable */
module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  moduleNameMapper: {
    '^(\\.\\./)+generated/prisma/(.*)$':
      '<rootDir>/src/__mocks__/generated-prisma.ts',
    '^(\\.\\./)+generated/prisma$':
      '<rootDir>/src/__mocks__/generated-prisma.ts',
    '^@crypto-trader/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@crypto-trader/analysis$': '<rootDir>/../../libs/analysis/src/index.ts',
    '^@crypto-trader/data-fetcher$':
      '<rootDir>/../../libs/data-fetcher/src/index.ts',
    '^@crypto-trader/trading-engine$':
      '<rootDir>/../../libs/trading-engine/src/index.ts',
    '^@crypto-trader/openrouter$':
      '<rootDir>/src/__mocks__/crypto-trader-openrouter.ts',
  },
};
