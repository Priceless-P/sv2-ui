import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { LiAltArrowLeft, LiAltArrowRight, LiAltArrowUp, LiAltArrowDown, LiCheckCircle } from 'solar-icon-react/li';
import { BoInfoCircle } from 'solar-icon-react/bo';
import { OlArrowRightUp } from 'solar-icon-react/ol';
import { cn } from '@/lib/utils';

/** Shared pieces used by the guide pages: headings, navigation, text, tables and the block drawing. */

/** An inline code chip: the most-used element on these pages. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1 py-0.5 text-xs leading-4 text-body-alt">{children}</span>
  );
}

/** The banner image at the top of a guide. */
export function DocHero({ src, height = 153, alt = '' }: { src: string; height?: number; alt?: string }) {
  return (
    <div className="overflow-hidden bg-[#3B82F6]" style={{ height }}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/** A section with a heading. Use level 3 for a section inside a section. */
export function DocSection({
  number,
  title,
  level = 2,
  children,
}: {
  number?: string;
  title: string;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section className={cn('flex flex-col gap-3', level === 3 && 'border-t-[0.5px] border-border pt-5')}>
      <div className="flex items-baseline gap-2">
        {number && <span className="text-sm leading-5 text-body-alt">{number}</span>}
        <Heading className="!font-body text-base font-semibold leading-6 text-heading">{title}</Heading>
      </div>
      {children}
    </section>
  );
}

/** The title at the top of a guide page. Shows "Step 2 of 3" when it is a step. */
export function DocSectionHeader({
  step,
  stepCount,
  title,
}: {
  step?: number;
  stepCount?: number;
  title: string;
}) {
  return (
    <header className="flex items-start gap-3">
      {step !== undefined && (
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info text-base font-semibold text-info-foreground"
        >
          {step}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {step !== undefined && stepCount && (
          <p className="text-xs font-medium uppercase leading-4 tracking-wider text-body-alt">
            Step {step} of {stepCount}
          </p>
        )}
        <h1 className="!font-body text-2xl font-semibold leading-8 tracking-[-0.5px] text-heading">{title}</h1>
      </div>
    </header>
  );
}

/** One entry in the guide's section nav. */
interface DocNavItem {
  href: string;
  label: string;
  /** Entries are grouped under this heading, in the order they appear. */
  group: string;
  /** A numbered step, drawn as its numeral on the rail instead of a plain dot. */
  step?: number;
  /** Ticked off, so the rail shows a check where the numeral was. */
  done?: boolean;
  active?: boolean;
}

/** A guide's list of pages: a side menu on wide screens, a scrolling row of pills on narrow ones. */
export function DocSectionNav({ items, collapsible = [] }: { items: DocNavItem[]; collapsible?: string[] }) {
  const groups: { label: string; items: DocNavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }

  const activeHref = items.find((i) => i.active)?.href;
  const [opened, setOpened] = useState<string[]>([]);
  const isOpen = (label: string) =>
    !collapsible.includes(label) ||
    opened.includes(label) ||
    items.some((i) => i.active && i.group === label);
  const toggle = (label: string) =>
    setOpened((o) => (o.includes(label) ? o.filter((l) => l !== label) : [...o, label]));

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // `nearest` vertically: centring the pill must not also scroll the page.
    const centre = () =>
      strip.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    centre();
    // On a cold load the pills are still in the fallback face, narrow enough that the
    // strip does not overflow yet and there is nothing to scroll. Once the real face
    // lands they are twice as wide, so centre again against the settled widths.
    void document.fonts?.ready.then(centre);
  }, [activeHref]);

  const pill = 'whitespace-nowrap rounded-full border-[0.5px] px-3 py-1.5 text-sm leading-5 transition-colors';

  return (
    <>
      <nav aria-label="Guide sections" className="-mx-4 overflow-x-auto px-4 lg:hidden">
        <div ref={strip} className="flex w-max gap-2 pb-1">
          {groups.map((group) =>
            isOpen(group.label) ? (
              group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? 'step' : undefined}
                  className={cn(
                    pill,
                    item.active
                      ? 'border-transparent bg-foreground text-background'
                      : 'border-border text-body-alt hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))
            ) : (
              <button
                key={group.label}
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={false}
                className={cn(pill, 'flex items-center gap-1 border-border text-body-alt')}
              >
                {group.label}
                <LiAltArrowDown className="h-3.5 w-3.5" />
              </button>
            ),
          )}
        </div>
      </nav>

      <nav
        aria-label="Guide sections"
        className="hidden w-56 shrink-0 flex-col gap-6 lg:sticky lg:top-0 lg:order-2 lg:flex lg:self-start"
      >
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            {collapsible.includes(group.label) ? (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={isOpen(group.label)}
                className="flex items-center gap-1 text-[11px] font-medium uppercase leading-4 tracking-wider text-placeholder transition-colors hover:text-body-alt"
              >
                {group.label}
                {isOpen(group.label) ? (
                  <LiAltArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <LiAltArrowDown className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <p className="text-[11px] font-medium uppercase leading-4 tracking-wider text-placeholder">
                {group.label}
              </p>
            )}
            <div className={cn('relative flex-col gap-3', isOpen(group.label) ? 'flex' : 'hidden')}>
              <span aria-hidden className="absolute bottom-2 left-[8.5px] top-2 w-px bg-border" />
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? 'step' : undefined}
                  className={cn(
                    'group flex items-start gap-3 text-sm leading-5 transition-colors',
                    item.active ? 'font-medium text-foreground' : 'text-body-alt hover:text-foreground',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none transition-colors',
                      item.step === undefined && 'bg-background',
                      item.step !== undefined &&
                        (item.active
                          ? 'bg-info font-semibold text-info-foreground'
                          : 'border border-border bg-background group-hover:text-foreground'),
                    )}
                  >
                    {item.done ? (
                      <LiCheckCircle className="h-[18px] w-[18px] text-success" />
                    ) : (
                      item.step ?? (
                      <span
                        className={cn(
                          'h-[7px] w-[7px] rounded-full transition-colors',
                          item.active ? 'bg-info' : 'bg-border group-hover:bg-placeholder',
                        )}
                      />
                      )
                    )}
                  </span>
                  <span className="min-w-0">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

/** Body copy. */
export function DocText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-5 text-body-alt">{children}</p>;
}

/** The one-line deck under a section title: what the reader gets, set a size up. */
export function DocLede({ children }: { children: ReactNode }) {
  return <p className="text-base leading-6 text-body-alt">{children}</p>;
}

export function DocList({ items, ordered = false }: { items: ReactNode[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={cn('flex flex-col gap-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, i) => (
        <li key={i} className="text-sm leading-5 text-body-alt">
          {item}
        </li>
      ))}
    </List>
  );
}

/**
 * A note callout: a tinted panel with a coloured left rule.
 */
export function DocCallout({
  label,
  check = false,
  children,
}: {
  label: string;
  check?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-l border-[#A855F7] bg-[#A855F7]/5 px-6 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium leading-5 text-foreground">
        {check && <LiCheckCircle className="h-4 w-4 shrink-0 text-[#A855F7]" />}
        {label}
      </p>
      <div className="text-sm leading-5 text-body-alt">{children}</div>
    </div>
  );
}

/** A reference table. */
export function DocTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const wide = headers.length > 3;
  const cell = wide ? 'px-4 py-3' : 'px-6 py-4';
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', wide ? 'min-w-[880px]' : 'min-w-[720px]')}>
        <thead>
          <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
            {headers.map((h) => (
              <th key={h} className={cn(cell, 'text-left font-normal')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b-[0.5px] border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={cn(cell, 'text-foreground')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One end of a guide pager: where it goes, and the section it lands on. */
interface DocPagerLink {
  href: string;
  label: string;
}

/** Previous and next buttons at the foot of a guide page. */
export function DocPager({ prev, next, guide }: { prev?: DocPagerLink; next?: DocPagerLink; guide: string }) {
  const button = 'inline-flex shrink-0 items-center gap-1 rounded-lg border-[0.5px] border-border px-3 py-1.5 text-sm leading-5 text-foreground transition-colors group-hover:bg-muted';

  return (
    <nav
      aria-label="Guide sections"
      className="flex items-center justify-between gap-4 border-t-[0.5px] border-border pt-6"
    >
      {prev ? (
        <Link href={prev.href} className="group flex min-w-0 items-center gap-3">
          <span className={button}>
            <LiAltArrowLeft className="h-3.5 w-3.5" />
            Previous
          </span>
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-semibold leading-5 text-heading">{prev.label}</span>
            <span className="truncate text-xs leading-4 text-body-alt">{guide}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}

      {next && (
        <Link href={next.href} className="group flex min-w-0 items-center gap-3">
          <span className="hidden min-w-0 flex-col text-right sm:flex">
            <span className="truncate text-sm font-semibold leading-5 text-heading">{next.label}</span>
            <span className="truncate text-xs leading-4 text-body-alt">{guide}</span>
          </span>
          <span className={button}>
            Next
            <LiAltArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}
    </nav>
  );
}

/**
 * The footer prompt that closes every guide page. It is the Info Prompt component in
 * its fuchsia variant, the one tint with no token yet.
 *
 * Its panel is a fixed pale fuchsia in both themes, so its ink is fixed too: the
 * theme's `foreground` inverts to near-white in dark mode and would vanish here.
 */
export function DocFooterPrompt({
  href,
  title = 'Need the complete implementation?',
  description = 'Explore the source code, documentation, examples, and setup guides on GitHub.',
  linkLabel = 'Open GitHub',
}: {
  href: string;
  title?: string;
  description?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#FAE8FF] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        <span className="shrink-0 pt-0.5">
          <BoInfoCircle className="h-5 w-5 text-[#D946EF]" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-5 text-[#4A044E]">{title}</p>
          <p className="text-sm leading-5 text-[#701A75]">{description}</p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 self-start border-b-[0.5px] border-[#4A044E] pb-0.5 text-sm leading-5 text-[#4A044E] transition-opacity hover:opacity-70 sm:self-auto"
      >
        {linkLabel}
        <OlArrowRightUp className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/** Which part of a block a feature reaches into. */
export type BlockPart = 'coinbase' | 'transactions' | 'version';

const BLOCK_ROWS = [92, 74, 88, 61, 80];

export function BlockDrawing({
  highlight,
  className,
}: {
  /** One part, or several: "the transactions and coinbase" is one claim about two parts. */
  highlight?: BlockPart | BlockPart[];
  className?: string;
}) {
  const lit = highlight === undefined ? [] : Array.isArray(highlight) ? highlight : [highlight];
  const on = (part: BlockPart) => lit.includes(part);
  const region = (part: BlockPart) =>
    cn('rounded p-1 transition-opacity', on(part) && 'bg-info/10', lit.length > 0 && !on(part) && 'opacity-30');

  return (
    <div aria-hidden className={cn('w-[132px] shrink-0 rounded-xl border-[0.5px] border-info/40 bg-card p-2', className)}>
      <div className={region('coinbase')}>
        <span className="block h-2 rounded-[2px] bg-info" />
      </div>
      <div className={cn(region('transactions'), 'mt-0.5')}>
        <div className="flex flex-col gap-[3px]">
          {BLOCK_ROWS.map((w, i) => (
            <span
              key={i}
              className={cn('h-1 rounded-[2px]', on('transactions') ? 'bg-info' : 'bg-info/30')}
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
      <div className={cn(region('version'), 'mt-0.5')}>
        <span className="flex gap-0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={cn('h-2 w-1 rounded-[0.5px]', on('version') || i % 3 === 0 ? 'bg-info' : 'bg-border')}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/** One thing owning your block gets you. `parts` ties it to the drawing. */
interface BlockPoint {
  text: string;
  parts?: BlockPart | BlockPart[];
}

export function BlockPoints({ points }: { points: BlockPoint[] }) {
  const [lit, setLit] = useState<BlockPart | BlockPart[] | undefined>();

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
      <BlockDrawing highlight={lit} />
      <div className="flex min-w-0 flex-1 flex-col">
        {points.map((point, i) => (
          <div
            key={point.text}
            onMouseEnter={() => setLit(point.parts)}
            onMouseLeave={() => setLit(undefined)}
            className={cn(
              'flex gap-3 rounded-lg px-2 py-2.5 transition-colors',
              i > 0 && 'border-t-[0.5px] border-border',
              point.parts && lit === point.parts && 'bg-muted',
            )}
          >
            <span
              className={cn(
                'mt-1.5 h-2 w-2 shrink-0 rounded-[2px]',
                point.parts ? (lit === point.parts ? 'bg-info' : 'bg-info/40') : 'bg-transparent',
              )}
            />
            <span className="text-sm leading-5 text-body-alt">{point.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocMarkedList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-3.5 border-l-[1.5px] border-border py-1 pl-5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[9px] h-[6px] w-[6px] shrink-0 rotate-45 bg-info/60" />
          <span className="min-w-0 text-sm leading-6 text-body-alt">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** One labelled box in the stack diagram. */
function StackBox({ name, note }: { name: string; note?: string }) {
  return (
    <div className="rounded-lg border-[0.5px] border-border bg-card px-3.5 py-2.5 text-center">
      <p className="whitespace-nowrap text-sm font-medium leading-5 text-heading">{name}</p>
      {note && <p className="text-xs leading-4 text-body-alt">{note}</p>}
    </div>
  );
}

/** A labelled arrow. `both` draws a head at each end, for a two-way link. */
function StackArrow({
  label,
  port,
  both = false,
  vertical = false,
}: {
  label: string;
  port?: string;
  both?: boolean;
  vertical?: boolean;
}) {
  const head = 'h-0 w-0 shrink-0 border-transparent';
  if (vertical) {
    return (
      <span aria-hidden className="flex items-center gap-2 py-1 pl-6 lg:flex-col lg:gap-1 lg:py-2 lg:pl-0">
        <span className="flex flex-col items-center">
          <span className="h-6 w-px bg-border" />
          <span className={cn(head, 'border-x-[4px] border-t-[6px] border-t-border')} />
        </span>
        <span className="text-[10px] uppercase leading-4 tracking-wider text-placeholder">{label}</span>
      </span>
    );
  }
  return (
    <span aria-hidden className="flex min-w-0 flex-col items-center gap-1 px-2">
      <span className="whitespace-nowrap text-[10px] uppercase leading-4 tracking-wider text-placeholder">{label}</span>
      <span className="flex w-full items-center">
        {both && <span className={cn(head, 'border-y-[4px] border-r-[6px] border-r-border')} />}
        <span className="h-px min-w-6 flex-1 bg-border" />
        <span className={cn(head, 'border-y-[4px] border-l-[6px] border-l-border')} />
      </span>
      {port && <span className="text-[10px] leading-4 text-placeholder">{port}</span>}
    </span>
  );
}

export function StackDiagram() {
  return (
    <div className="overflow-x-auto">
      {/* Wide: the real topology, on a five-column grid so the branch sits under the client. */}
      <div className="hidden min-w-[720px] grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-y-1 lg:grid">
        <StackBox name="ASICs" />
        <StackArrow label="SV1 (stratum+tcp)" port=":32767" />
        <StackBox name="DMND Client" />
        <StackArrow label="SV2 + Job Declaration" port=":20000" />
        <StackBox name="DMND Pool" />

        <span className="col-start-3 flex justify-center">
          <StackArrow label="templates" vertical />
        </span>

        <span className="col-start-3">
          <StackBox name="sv2-tp" note="Template Provider · :8336" />
        </span>
        <span className="col-start-4">
          <StackArrow label="IPC (unix socket)" both />
        </span>
        <span className="col-start-5">
          <StackBox name="Bitcoin Core" note="your node" />
        </span>
      </div>

      {/* Narrow: the same links, read top to bottom. */}
      <div className="flex flex-col items-start lg:hidden">
        <StackBox name="ASICs" />
        <StackArrow label="SV1 · :32767" vertical />
        <StackBox name="DMND Client" />
        <StackArrow label="SV2 + Job Declaration · :20000" vertical />
        <StackBox name="DMND Pool" />
        <span className="mt-4 text-[10px] uppercase leading-4 tracking-wider text-placeholder">
          templates into the client
        </span>
        <StackArrow label="" vertical />
        <StackBox name="sv2-tp" note="Template Provider · :8336" />
        <StackArrow label="IPC (unix socket)" vertical />
        <StackBox name="Bitcoin Core" note="your node" />
      </div>
    </div>
  );
}
