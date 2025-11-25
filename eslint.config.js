const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Forbid usage of any - can only be allowed via eslint-disable-next-line
      '@typescript-eslint/no-explicit-any': 'error',
      
      // Forbid unused variables (except those prefixed with _)
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      
      // Require explicit return types for functions
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'coverage/',
      'ios/',
      'android/',
    ],
  },
];

