// Mobile app lint config. The repo-root config ignores apps/, so this one is the
// root for the Expo app. Plugins resolve from the repo's node_modules.
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  globals: { __DEV__: 'readonly' },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['node_modules', '.expo', 'dist', 'web-build', '._*', '.eslintrc.cjs', 'expo-env.d.ts'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off',
  },
};
