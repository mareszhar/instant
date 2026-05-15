// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from '@mszr/idb-vux'
import type { AppSchema } from './instant.schema'

const IS_SIGNED_IN = 'auth.id != null'
const IS_SELF_USER = 'auth.id == data.id'

const SHARES_WORKSPACE_WITH_USER
  = 'auth.id in data.ref(\'memberships.workspace.memberships.user.id\')'

const IS_MEMBER_FROM_WORKSPACE = 'auth.id in data.ref(\'memberships.user.id\')'
const IS_OWNER_FROM_WORKSPACE = 'auth.id in data.ref(\'owner.id\')'
const HAS_INVITE_CODE_ON_WORKSPACE
  = 'ruleParams.inviteCode != null && ruleParams.inviteCode == data.inviteCode'

const IS_MEMBER_FROM_MEMBERSHIP
  = 'auth.id in data.ref(\'workspace.memberships.user.id\')'
const IS_OWNER_FROM_MEMBERSHIP
  = 'auth.id in data.ref(\'workspace.owner.id\')'
const IS_SELF_FROM_MEMBERSHIP = 'auth.id in data.ref(\'user.id\')'
const HAS_INVITE_CODE_ON_MEMBERSHIP
  = 'ruleParams.inviteCode != null && ruleParams.inviteCode in data.ref(\'workspace.inviteCode\')'

const IS_MEMBER_FROM_TASK = 'auth.id in data.ref(\'workspace.memberships.user.id\')'
const ASSIGNEE_IN_WORKSPACE = 'linkedData.id in data.ref(\'workspace.memberships.user.id\')'
const LINKED_WORKSPACE_MATCHES_INVITE
  = 'ruleParams.inviteCode != null && ruleParams.inviteCode == linkedData.inviteCode'

const rules = {
  attrs: {
    allow: {
      create: 'false',
    },
  },
  $default: {
    allow: {
      $default: 'false',
    },
  },
  $users: {
    allow: {
      view: `${IS_SELF_USER} || ${SHARES_WORKSPACE_WITH_USER}`,
      create: 'true',
      update: IS_SELF_USER,
    },
    fields: {
      email: `${IS_SELF_USER} || ${SHARES_WORKSPACE_WITH_USER}`,
    },
  },
  workspaces: {
    bind: {
      isSignedIn: IS_SIGNED_IN,
      isMember: IS_MEMBER_FROM_WORKSPACE,
      isOwner: IS_OWNER_FROM_WORKSPACE,
      hasInviteCode: HAS_INVITE_CODE_ON_WORKSPACE,
    },
    allow: {
      view: 'isMember || hasInviteCode',
      create: 'isSignedIn',
      update: 'isOwner',
      delete: 'isMember',
      link: {
        owner: 'linkedData.id == auth.id',
      },
      unlink: {
        owner: 'false',
      },
    },
  },
  memberships: {
    bind: {
      isSignedIn: IS_SIGNED_IN,
      isMember: IS_MEMBER_FROM_MEMBERSHIP,
      isOwner: IS_OWNER_FROM_MEMBERSHIP,
      isSelf: IS_SELF_FROM_MEMBERSHIP,
      hasInviteCode: HAS_INVITE_CODE_ON_MEMBERSHIP,
    },
    allow: {
      view: 'isMember',
      create: 'isSignedIn',
      update: 'isSelf',
      delete: 'isSelf',
      link: {
        user: 'linkedData.id == auth.id',
        workspace: `isMember || isOwner || ${LINKED_WORKSPACE_MATCHES_INVITE}`,
      },
      unlink: {
        user: 'isSelf',
        workspace: 'isSelf',
      },
    },
  },
  tasks: {
    bind: {
      isSignedIn: IS_SIGNED_IN,
      isMember: IS_MEMBER_FROM_TASK,
    },
    allow: {
      view: 'isMember',
      create: 'isSignedIn && isMember',
      update: 'isMember',
      delete: 'isMember',
      link: {
        workspace: 'isMember',
        assignee: `isMember && ${ASSIGNEE_IN_WORKSPACE}`,
      },
      unlink: {
        workspace: 'false',
        assignee: 'isMember',
      },
    },
  },
} satisfies InstantRules<AppSchema>

export default rules
