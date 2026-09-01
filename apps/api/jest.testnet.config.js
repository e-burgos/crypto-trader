/* eslint-disable */
const base = require('./jest.config.js');

const { moduleNameMapper } = base;
const realPrismaMapper = Object.fromEntries(
  Object.entries(moduleNameMapper).filter(
    ([pattern]) => !pattern.includes('generated/prisma'),
  ),
);

module.exports = {
  ...base,
  displayName: 'api-testnet',
  moduleNameMapper: realPrismaMapper,
  testMatch: ['<rootDir>/src/**/*.testnet.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 120_000,
};
