const js = require('@eslint/js');
const globals = require('globals');

const rules = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-console': 'off',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
};

module.exports = [
  { ignores: ['node_modules/**', '.vercel/**', '.next/**', 'seed/enquiries/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules,
  },
  {
    // Next.js app and React components: ES modules with JSX, run on server and in the browser.
    files: ['app/**/*.js', 'components/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...rules,
      // JSX element usage is not seen by core no-unused-vars without the react plugin.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^[A-Z]' },
      ],
    },
  },
];
