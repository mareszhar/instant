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
    quests: i.entity({
      title: i.string().indexed(),
      status: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: '$users',
        has: 'one',
        label: 'linkedPrimaryUser',
        onDelete: 'cascade',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'linkedGuestUsers',
      },
    },
    questRequestor: {
      forward: {
        on: 'quests',
        has: 'one',
        label: 'requestor',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'requestedQuests',
      },
    },
    questAssignee: {
      forward: {
        on: 'quests',
        has: 'one',
        label: 'assignee',
      },
      reverse: {
        on: '$users',
        has: 'many',
        label: 'assignedQuests',
      },
    },
  },
  rooms: {
    demo: {
      presence: i.entity({
        name: i.string(),
        status: i.string().optional(),
        chat: i.boolean().optional(),
      }),
      topics: {
        reaction: i.entity({
          emoji: i.string(),
        }),
        ping: i.entity({
          message: i.string(),
        }),
      },
    },
  },
})

type AppSchema = typeof schema

export type { AppSchema }
export default schema
