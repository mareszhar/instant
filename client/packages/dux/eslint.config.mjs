// @ts-check
import antfu from '@antfu/eslint-config'

/*
 * Layer boundaries (docs/dux-spec-workspace.md → "Boundary rules").
 *
 * Plane separation is load-bearing: inner layers never import outer layers;
 * only vue/ may import vue; only a server adapter (h3/, hono/, elysia/)
 * may import its framework, and the framework-agnostic server core (server/)
 * imports none. The rules ban by import specifier, so they cover packages and
 * relative paths alike. Note that
 * `**[slash]name` also matches the bare specifier `name` — so banning the
 * `vue` *layer* also bans the `vue` *package*, which is intended everywhere
 * the layer is banned.
 */

// The server frameworks a single adapter may import (one of these, per adapter).
const serverFrameworks = ['h3', 'h3/*', 'hono', 'hono/*', 'elysia', 'elysia/*']
// Everything the agnostic + server-core layers must never import.
const frameworks = ['vue', 'vue/*', '@vue/*', ...serverFrameworks]
// The server adapter layer folders.
const adapterLayers = ['h3', 'hono', 'elysia']

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

/**
 * A server adapter imports only its own framework and the server core — it
 * reaches schema/query/tx/admin/webhooks through `/server`, never directly. The
 * inner-layer ban deliberately omits the sibling adapter folders: the 'h3'
 * adapter folder shares a name with the 'h3' framework package, so a folder-name
 * glob would also ban the package the h3 adapter needs. Cross-framework imports
 * are blocked by package, which is the import that actually matters.
 * @param {string[]} ownFw this adapter's framework specifiers (e.g. ['h3', 'h3/*'])
 */
function adapterBoundary(ownFw) {
  return [
    { group: serverFrameworks.filter(f => !ownFw.includes(f)), message: 'An adapter imports only its own framework.' },
    { group: ['vue', 'vue/*', '@vue/*'], message: 'Only vue/ may import vue.' },
    { group: official('@instantdb/core'), message: 'An adapter composes the server core; official packages enter via /server, never directly.' },
    { group: layers('schema', 'query', 'tx', 'perms', 'webhooks', 'admin'), message: 'An adapter imports only its framework and the server core — reach schema/query/tx/admin/webhooks through /server.' },
  ]
}

const agnostic = 'The framework-agnostic plane never imports a framework.'
const server = 'The server plane never imports a framework.'

const boundaries = {
  'schema': [
    { group: official('@instantdb/core'), message: 'schema is the innermost layer — @instantdb/core is its only official dependency.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'tx', 'perms', 'webhooks', 'admin', 'vue', 'server', ...adapterLayers), message: 'schema imports nothing above itself.' },
  ],
  'query': [
    { group: official('@instantdb/core'), message: 'query may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('tx', 'perms', 'webhooks', 'admin', 'vue', 'server', ...adapterLayers), message: 'query may reach only into schema.' },
  ],
  'tx': [
    { group: official('@instantdb/core'), message: 'tx may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'perms', 'webhooks', 'admin', 'vue', 'server', ...adapterLayers), message: 'tx may reach only into schema.' },
  ],
  'perms': [
    { group: official('@instantdb/core'), message: 'perms may import only @instantdb/core and the schema layer.' },
    { group: frameworks, message: agnostic },
    { group: layers('query', 'tx', 'webhooks', 'admin', 'vue', 'server', ...adapterLayers), message: 'perms may reach only into schema.' },
  ],
  'webhooks': [
    { group: official('@instantdb/core', '@instantdb/webhooks'), message: 'webhooks wraps @instantdb/webhooks over the schema layer — it is admin-free by design.' },
    { group: frameworks, message: server },
    { group: layers('query', 'tx', 'perms', 'admin', 'vue', 'server', ...adapterLayers), message: 'webhooks may reach only into schema.' },
  ],
  'admin': [
    { group: official('@instantdb/core', '@instantdb/admin'), message: 'admin wraps @instantdb/admin; the official webhooks package enters only via the webhooks layer.' },
    { group: frameworks, message: server },
    { group: layers('perms', 'vue', 'server', ...adapterLayers), message: 'admin composes schema, query, tx, and webhooks — never the client overlay or the server adapters.' },
  ],
  'vue': [
    { group: serverFrameworks, message: 'Only a server adapter may import a server framework.' },
    { group: official('@instantdb/core', '@instantdb/vue'), message: 'vue composes the agnostic plane; @instantdb/vue exists here only as the baseline mirror source and parity anchor.' },
    { group: layers('perms', 'webhooks', 'admin', 'server', ...adapterLayers), message: 'The client overlay composes schema, query, and tx — never the server plane.' },
  ],
  'server': [
    { group: frameworks, message: server },
    { group: official('@instantdb/core'), message: 'The server core composes the dux admin and webhooks layers, never the official packages directly.' },
    { group: layers('perms', 'vue', ...adapterLayers), message: 'The server core composes schema, query, tx, admin, and webhooks — never an adapter or the client overlay.' },
  ],
  'h3': adapterBoundary(['h3', 'h3/*']),
  'hono': adapterBoundary(['hono', 'hono/*']),
  'elysia': adapterBoundary(['elysia', 'elysia/*']),
  'test-support': [
    { group: frameworks, message: 'Fixtures live on the agnostic plane.' },
    { group: official('@instantdb/core'), message: 'Fixtures live on the agnostic plane.' },
    { group: layers('vue', 'webhooks', 'admin', 'server', ...adapterLayers), message: 'Fixtures live on the agnostic plane.' },
  ],
}

/**
 * Compat suites may import official packages as targets, but they still obey
 * framework/layer boundaries.
 * @param {Array<{ group: string[], message: string }>} patterns
 */
function withoutOfficialPackageBans(patterns) {
  return patterns.filter(({ group }) => !group.includes('@instantdb/*'))
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
  ...Object.entries(boundaries).map(([layer, patterns]) => ({
    // Compatibility-target suites feed dux output into official tools dux
    // doesn't wrap, so official-package bans are lifted there. Layer and
    // framework boundaries still apply.
    files: [
      `idb-dux/src/${layer}/**/*.compat.test.ts`,
      `idb-dux/src/${layer}/**/*.compat.test-d.ts`,
    ],
    rules: {
      'no-restricted-imports': /** @type {['error', { patterns: Array<{ group: string[], message: string }> }]} */ (['error', { patterns: withoutOfficialPackageBans(patterns) }]),
    },
  })),
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
