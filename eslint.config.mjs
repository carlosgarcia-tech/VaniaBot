import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import vaniaPlugin from './eslint-plugin-vania/index.js';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'vaniasession/**',
      'data/temp/**',
      'logs/**',
      'redis-data/**',
      '**/*.js',
    ],
  },
  {
    files: ['src/**/*.ts', 'vania.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript specific rules - enabled with warnings
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // General rules - improved
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['warn', 'always'],
      'no-throw-literal': 'error',

      // Prettier integration - ENABLED
      'prettier/prettier': ['warn', {}, { usePrettierrc: true }],
      ...prettierConfig.rules,
    },
  },
  {
    // Command permission conventions (see eslint-plugin-vania/index.js).
    files: ['src/commands/**/*.ts'],
    plugins: { vania: vaniaPlugin },
    rules: {
      'vania/no-permission-typo': 'error',
      'vania/owner-requires-owner-permission': 'error',
    },
  },
];
