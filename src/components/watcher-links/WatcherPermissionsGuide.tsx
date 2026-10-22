import { ALL_WATCHER_SCOPES, SCOPE_DESCRIPTIONS, scopeLabel } from '@/lib/watcherLinks';

export function WatcherPermissionsGuide() {
  return (
    <section aria-labelledby="watcher-permissions-heading" className="rounded-xl border border-border bg-card p-4 lg:p-5">
      <h3 id="watcher-permissions-heading" className="text-sm font-semibold text-foreground">Permissions guide</h3>
      <p className="mt-1 text-sm leading-5 text-body-alt">Watcher links provide read-only access to the permissions selected when they are created.</p>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {ALL_WATCHER_SCOPES.map((scope) => (
          <div key={scope}>
            <dt className="text-sm font-medium text-foreground">{scopeLabel(scope)}</dt>
            <dd className="mt-1 text-sm leading-5 text-body-alt">{SCOPE_DESCRIPTIONS[scope]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
