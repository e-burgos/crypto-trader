import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      // Dependencies are managed at the root package.json — rule not applicable to private libs
      '@nx/dependency-checks': 'off',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
