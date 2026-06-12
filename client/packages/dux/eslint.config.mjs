// @ts-check
import antfu from '@antfu/eslint-config'

/*
 * Layer boundaries (docs/dux-spec-workspace.md → "Boundary rules").
 *
 * Plane separation is load-bearing: inner layers never import outer layers;
 * only vue/ may import vue; only nuxt/ may import h3. The rules ban by import
 * specifier, so they cover packages and relative paths alike. Note that
 * `**[slash]name` also matches the bare specifier `name` — so banning the
 * `vue` *layer* also bans the `vue` *package*, which is intended everywhere
 * the layer is banned.
 */

const frameworks = ['vue', 'vue/*', '@vue/*', 'h3', 'h3/*']

/**
 * Ban every @instantdb package except the listed ones. `@instantdb/core` and
 * `@instantdb/version` are the two foundational dependencies every dux user
 * has (the peer rule, dux-spec-workspace.md §2), so they are always allowed.
 * @param {...string} allowed
 */
function official(...allowed) {
  const permitted = new Set(['@instantdb/core', '@instantdb/version', ...allowed])
  return ['@instantdb/*', ...[...permitted].map(name => `!${name}`)]
}

/**
 * Ban the listed src layers as import-path segments.
 * @param {...string} names
 */
function layers(...names) {
  return names.flatMap(name => [`**/${name}`, `**/${name}/**`])
}

const agnostic = 'The framework-agnostic plane never imports a framework.'
const server = 'The server plane never imports a framework.'

const boundaries = {
  'schema': [
    { group: official('@instantdb/core'), message: 'schema is the innermost layer — @instantdb/core is its only official dependency.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'tx', 'perms', 'webhooks', 'admin', 'vue', 'nuxt'), message: 'schema imports nothing above itself.' },
  ],
  'query': [
    { group: official('@instantdb/core'), message: 'query may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('tx', 'perms', 'webhooks', 'admin', 'vue', 'nuxt'), message: 'query may reach only into schema.' },
  ],
  'tx': [
    { group: official('@instantdb/core'), message: 'tx may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'perms', 'webhooks', 'admin', 'vue', 'nuxt'), message: 'tx may reach only into schema.' },
  ],
  'perms': [
    { group: official('@instantdb/core'), message: 'perms may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'tx', 'webhooks', 'admin', 'vue', 'nuxt'), message: 'perms may reach only into schema.' },
  ],
  'webhooks': [
    { group: official('@instantdb/core', '@instantdb/webhooks'), message: 'webhooks wraps @instantdb/webhooks over the schema layer — it is admin-free by design.' },
    { group: frameworks, message: server },
    { group: layers('query', 'tx', 'perms', 'admin', 'vue', 'nuxt'), message: 'webhooks may reach only into schema.' },
  ],
  'admin': [
    { group: official('@instantdb/core', '@instantdb/admin'), message: 'admin wraps @instantdb/admin; the official webhooks package enters only via the webhooks layer.' },
    { group: frameworks, message: server },
    { group: layers('perms', 'vue', 'nuxt'), message: 'admin composes schema, query, tx, and webhooks — never the client overlays.' },
  ],
  'vue': [
    { group: ['h3', 'h3/*'], message: 'Only nuxt/ may import h3.' },
    { group: official('@instantdb/core', '@instantdb/vue'), message: 'vue composes the agnostic plane; @instantdb/vue exists here only as the baseline mirror source and parity anchor.' },
    { group: layers('perms', 'webhooks', 'admin', 'nuxt'), message: 'The client overlay composes schema, query, and tx — never the server plane.' },
  ],
  'nuxt': [
    { group: ['vue', 'vue/*', '@vue/*'], message: 'Only vue/ may import vue.' },
    { group: official('@instantdb/core'), message: 'nuxt composes the dux admin and webhooks layers, never the official packages directly.' },
    { group: layers('perms', 'vue'), message: 'nuxt glues h3 onto the admin and webhooks layers.' },
  ],
  'test-support': [
    { group: frameworks, message: 'Fixtures live on the agnostic plane.' },
    { group: official('@instantdb/core'), message: 'Fixtures live on the agnostic plane.' },
    { group: layers('vue', 'webhooks', 'admin', 'nuxt'), message: 'Fixtures live on the agnostic plane.' },
  ],
}

export default await antfu(
  {
    formatters: true,
    vue: true,
    ignores: [
      '**/.nuxt/**',
      '**/.output/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.tshy/**',
      '**/.turbo/**',
      '.vscode/**',
      '.npm-cache/**',
      'packs/**',
    ],
  },
  {
    rules: {
      'markdown/require-alt-text': 'off',

      // Linked relationships in query/type syntax are spelled with empty
      // object literals (eg: IdbQueryEntity<'todos', { assignee: {} }>)
      'ts/no-empty-object-type': 'off',
    },
  },
  ...Object.entries(boundaries).map(([layer, patterns]) => ({
    files: [`idb-dux/src/${layer}/**`],
    rules: {
      'no-restricted-imports': /** @type {['error', { patterns: Array<{ group: string[], message: string }> }]} */ (['error', { patterns }]),
    },
  })),
  {
    // Compatibility-target suites exist to feed dux output into the official
    // tools dux doesn't wrap (platform validateSchema/schemaPush, the CLI
    // contract, resumable-stream) — the official-package bans don't apply to
    // them. Everything else in the boundary matrix still does.
    files: ['idb-dux/src/**/*.compat.test.ts', 'idb-dux/src/**/*.compat.test-d.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test-d.ts', '**/*.vue'],
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
