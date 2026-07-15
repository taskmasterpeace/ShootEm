import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // the sim intentionally uses empty catch for non-fatal asset loads
      'no-empty': ['error', { allowEmptyCatch: true }],
      // `any` appears only at debug-handle boundaries; keep the signal useful
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'tools/', '*.config.js', 'vite.config.ts'],
  },
);
