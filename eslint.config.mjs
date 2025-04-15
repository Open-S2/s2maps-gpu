// @ts-check

import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import jsdoc from 'eslint-plugin-jsdoc';
import prettierConfig from 'eslint-config-prettier';
// import withNuxt from './.nuxt/eslint.config.mjs';
// TODO: Eventually support tsdoc instead of jsdoc [https://github.com/microsoft/tsdoc/issues/374]
// albiet it seems like jsdoc gets way more love and has a ton of ts support
// import tsdocs from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

// export default withNuxt(
export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  // ...(await withNuxt()),
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
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
      'jsdoc/check-tag-names': ['warn', { definedTags: ['experimental'] }],
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
    },
  },
);
