import { i } from '@mszr/idb-vux'

const schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
  },
})

type AppSchema = typeof schema

export type { AppSchema }
export default schema
