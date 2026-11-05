import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.vscode-test/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', ecmaVersion: 2022, globals: globals.node },
  },
];
