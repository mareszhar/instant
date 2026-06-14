import { defineSchema, i } from '@mszr/idb-dux'

export const schema = defineSchema({
  namespaces: {
    $files: i.namespace({
      fields: {
        path: i.string().unique().indexed(),
        url: i.string(),
      },
    }),
    $users: i.namespace({
      fields: {
        email: i.string().unique().indexed().optional(),
        imageURL: i.string().optional(),
        type: i.string().optional(),
      },
    }),
  },
})

export type AppSchema = typeof schema
export default schema

declare module '@mszr/idb-dux' {
  interface IdbRegister {
    schema: typeof schema
  }
}
