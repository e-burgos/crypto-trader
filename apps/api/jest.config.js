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
    '^(\\.\\./)+generated/prisma/(.*)$': '<rootDir>/src/__mocks__/generated-prisma.ts',
    '^(\\.\\./)+generated/prisma$': '<rootDir>/src/__mocks__/generated-prisma.ts',
  },
};
