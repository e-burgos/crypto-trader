const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
// eslint-disable-next-line @nx/enforce-module-boundaries
const uiPreset = require('../../libs/ui/src/lib/tokens/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [uiPreset],
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
