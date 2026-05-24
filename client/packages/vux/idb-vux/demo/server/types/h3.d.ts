declare module 'h3' {
  interface H3EventContext {
    db: AdminDb
    scopedDb: AdminDb | null
    user: AuthUser | null
  }
}

export {} // add this to the end of the file to make it a module
