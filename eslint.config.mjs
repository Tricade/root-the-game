import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['vendor/**', 'asset-pack/**', 'node_modules/**', '.asset-build/**', '.local-data/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
