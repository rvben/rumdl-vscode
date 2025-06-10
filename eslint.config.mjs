import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: {
      prettier,
    },
    rules: {
      // Core rules
      curly: 'error',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      semi: 'off',

      // Relax some TypeScript rules for development
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',

      // Prettier rules
      'prettier/prettier': 'error',
    },
  },
  {
    ignores: ['out/', 'dist/', '**/*.d.ts', 'bundled-tools/'],
  }
);