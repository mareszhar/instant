/**
 * The `/nuxt` public types — the kit config and the mode-narrowed kit shapes.
 * `/nuxt` owns no data-plane or verification types of its own; everything it
 * returns comes from the `/admin` and `/webhooks` layers it composes.
 */
import type { H3Event } from 'h3'
import type { IdbAdminClient, IdbAuthUser } from '../admin/index.js'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'

/** `defineServerKit` config — the schema plus lazy, event-scoped credential reads. */
export interface IdbServerKitConfig<S extends IdbSchema = IdbRegisteredSchema> {
  /** Your registered schema — unlocks shaping and typed `ruleParams`. */
  schema: S
  /** Resolve the app id from the event (runtime config, env indirection, …). */
  getAppId: (event: H3Event) => string
  /** Resolve the admin token from the event. */
  getAdminToken: (event: H3Event) => string
  /** Base URL for the Instant API (self-hosting). */
  apiURI?: string
}

/**
 * How strict the kit is about auth, declared at the call site. The kit's keys
 * follow the mode, so there is no manual narrowing or repeated 401 boilerplate.
 */
export type IdbServerKitMode = 'user?' | 'user' | 'userDb?' | 'userDb'

/** The kit a given mode yields — keys typed per the declared strictness. */
export type IdbServerKit<Mode extends IdbServerKitMode | undefined, S extends IdbSchema>
  = Mode extends undefined
    ? { adminDb: IdbAdminClient<S> }
    : Mode extends 'user'
      ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser }
      : Mode extends 'user?'
        ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser | undefined }
        : Mode extends 'userDb'
          ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser, userDb: IdbAdminClient<S> }
          : { adminDb: IdbAdminClient<S>, user: IdbAuthUser | undefined, userDb: IdbAdminClient<S> | undefined }

/** The request-kit factory `defineServerKit` returns. */
export interface IdbServerKitFactory<S extends IdbSchema> {
  (event: H3Event): Promise<IdbServerKit<undefined, S>>
  <Mode extends IdbServerKitMode>(event: H3Event, mode: Mode): Promise<IdbServerKit<Mode, S>>
}

/** `defineAuthSyncHandler` config — the app id read from the event. */
export interface IdbAuthSyncConfig {
  /** Resolve the app id from the event (must match the client's app id). */
  getAppId: (event: H3Event) => string
}
