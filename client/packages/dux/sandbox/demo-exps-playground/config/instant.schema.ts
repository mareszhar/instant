import { defineSchema, i } from '@mszr/idb-dux'

export const schema = defineSchema({
  namespaces: {
    $users: i.namespace({
      fields: {
        email: i.string().unique().indexed().optional(),
      },
    }),
    fruits: i.namespace({
      fields: {
        name: i.string(['apple', 'banana', 'orange']).indexed(),
      },
    }),
  },
  links: {},
  rooms: {
    picnic: i.room({
      presence: {
        name: i.string(),
        typing: i.boolean().optional(),
      },
      topics: {
        reaction: { emoji: i.string() },
      },
    }),
  },
})

export type AppSchema = typeof schema
export default schema

// Register the schema once — `q` and every `Idb*` type utility then default
// to it across the whole project.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-conventions.md#7-global-schema-registration
declare module '@mszr/idb-dux' {
  interface IdbRegister {
    schema: typeof schema
  }
}
