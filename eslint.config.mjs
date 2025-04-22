// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';
import pluginVue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
// Add tsdoc as a plugin
// import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

import svelteConfig from './frameworks/svelte.config.js';
// import svelteParser from 'svelte-eslint-parser';

export default tseslint.config(
  {
    ignores: [
      '*.d.ts',
      '**/coverage',
      '**/docs',
      '**/dist',
      '**/buildS2',
      '**/buildS2-dev',
      '**/buildS2-local',
      '**/buildS2-flat',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...svelte.configs.recommended,
  // Typescript, React, Vue, Javascript, etc.
  {
    plugins: {
      'typescript-eslint': tseslint.plugin,
      // tsdoc,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        // svelte: true,
      },
      parserOptions: {
        parser: tseslint.parser,
        project: ['./tsconfig.eslint.json'],
        extraFileExtensions: ['.vue', '.svelte'],
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
        svelteConfig,
      },
    },
  },
  eslintPluginPrettierRecommended,
  prettierConfig,
  ...svelte.configs.prettier,
  jsdoc.configs['flat/recommended-typescript'],
  {
    rules: {
      // ensure explicit comparisons
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': ['error', { boolean: false, number: true, string: true }],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-extra-boolean-cast': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
      // manage promises correctly
      '@typescript-eslint/no-misused-promises': 'error',
      'no-async-promise-executor': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      'require-await': 'error',
      // console logs
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // https://github.com/gajus/eslint-plugin-jsdoc
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
        },
      ],
      'jsdoc/check-tag-names': [
        'warn',
        { definedTags: ['experimental', 'source', 'defaultValue'] },
      ],
      'jsdoc/no-blank-block-descriptions': 'warn',
      // 'jsdoc/no-missing-syntax': 'warn',
      'jsdoc/no-blank-blocks': 'warn',
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: false,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'single', 'multiple'],
          allowSeparatedGroups: true,
        },
      ],
      // allow variables with underscores to not be used
      '@typescript-eslint/no-unused-vars': [
        'error', // or "error"
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
);
