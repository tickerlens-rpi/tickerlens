// ESLint configuration for the TickerLens frontend.
//
// The base rule set mirrors gts 7.0.0, Google's TypeScript style linter
// (https://github.com/google/gts), so the code follows the Google TypeScript
// Style Guide (https://google.github.io/styleguide/tsguide.html). The rules are
// copied rather than imported from the gts package because gts pins ESLint 9
// and a single tsconfig.json, while this Vite project uses ESLint 10 and
// TypeScript project references. React, Vite and Vitest specifics are layered
// on top. See ../docs/CODING_CONVENTIONS.md for the rationale.
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import {defineConfig, globalIgnores} from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules']),

  // ---- Google style: gts base rules (every linted file) -------------------
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {prettier: prettierPlugin},
    rules: {
      'prettier/prettier': 'error',
      'block-scoped-var': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eol-last': 'error',
      'prefer-arrow-callback': 'error',
      'no-trailing-spaces': 'error',
      quotes: ['warn', 'single', {avoidEscape: true}],
      'no-restricted-properties': [
        'error',
        {object: 'describe', property: 'only'},
        {object: 'it', property: 'only'},
      ],
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {globals: globals.node},
  },

  // ---- Google style: gts TypeScript rules, plus React and Vite ------------
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-warning-comments': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-dupe-class-members': 'off',
      'require-atomic-updates': 'off',
    },
  },

  // ---- Vitest test files --------------------------------------------------
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    extends: [vitest.configs.recommended],
  },
]);
