import nextEnv from '@next/env'

// Use Next's precedence and interpolation rules for CLI commands too.
// Shell-provided values still win, keeping disposable local tests isolated.
// APP_ENV selects our database boundary; it is independent of NODE_ENV.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development', {
  info: () => {},
  error: () => { throw new Error('Unable to load environment files; check their syntax and permissions locally.') },
})
