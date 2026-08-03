export type AppEnv = 'local' | 'staging' | 'production';

const VITE_ENV = (import.meta as { env?: { VITE_APP_ENV?: string; DEV?: boolean } }).env;

/**
 * Which deployment this bundle was built for, from the build-time VITE_APP_ENV.
 * Unset means a dev server (local) or an untagged build, which falls back to staging
 */
export const APP_ENV: AppEnv = ((): AppEnv => {
  const env = VITE_ENV?.VITE_APP_ENV;
  if (env === 'local' || env === 'staging' || env === 'production') return env;
  return VITE_ENV?.DEV ? 'local' : 'staging';
})();

/**
  * The pool URL to connect to, which varies by environment.
 */
const POOL_URL_BY_ENV: Record<AppEnv, string> = {
  local: 'stratum+tcp://127.0.0.1:32767',
  staging: 'stratum+tcp://staging-pool-one.dmnd.work:3456',
  production: 'stratum+tcp://proxy.dmnd.work:3456',
};

/** Shared by the home connect-workers card and the account setup connect step. */
export const POOL_URL = POOL_URL_BY_ENV[APP_ENV];

/** The miner username on DMND is free-form, so this is guidance, not a value. */
export const POOL_USERNAME_HINT = 'Any value or leave empty';

/**
 * The setup tutorial / learning resource. Empty until DMND provides a real URL, so
 * every caller renders the prompt without a link rather than pointing at a page that
 * would not resolve. Fill this in once the URL exists and the links light up.
 */
export const SETUP_TUTORIAL_URL = '';
