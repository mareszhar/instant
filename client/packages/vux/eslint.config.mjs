// @ts-check
import antfu from '@antfu/eslint-config'

export default await antfu(
  {
    formatters: true,
    vue: true,
    ignores: [
      '**/.nuxt/**',
      '**/.output/**',
      '**/node_modules/**',
      '.vscode/**',
      '.npm-cache/**',
      'dist/**',
      'packs/**',
    ],
  },
  {
    rules: {
      'markdown/require-alt-text': 'off',

      // Prevent issue of ESLint conflicting with instantdb notation in utility types that
      // describe linked relationships (eg: InstaQLEntity<AppSchema, 'todos', { goals: { } }>)
      'ts/no-empty-object-type': 'off',
    },
  },
  {
    files: ['**/src/tests/**/*.ts', '**/*.vue'],
    rules: {
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // Establish preferred languages and order of blocks in Vue files
      'vue/block-order': ['error', {
        order: ['template[lang="pug"]', 'script[setup][lang="ts"]', 'style[lang="stylus"]'],
      }],

      // Allow defining variables before props (useful for defaults)
      'vue/define-macros-order': 'off',
    },
  },
  {
    files: ['**/*.md'],
    rules: {
      'format/prettier': 'off',
    },
  },
)
