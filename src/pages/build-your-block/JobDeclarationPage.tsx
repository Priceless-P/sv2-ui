import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { LiArrowRightUp, LiAltArrowRight } from 'solar-icon-react/li';
import heroImage from '@/assets/guide-hero-job-declaration.png';
import {
  BlockDrawing,
  BlockPoints,
  Chip,
  DocCallout,
  DocFooterPrompt,
  DocHero,
  DocLede,
  DocList,
  DocPager,
  DocSection,
  DocSectionHeader,
  DocSectionNav,
  DocText,
  StackDiagram,
} from '@/components/docs/DocPrimitives';
import {
  CodeBlock,
  CommandLegend,
  DocPage,
  StepDone,
  useGuideTicks,
} from '@/components/docs/DocGuide';

const SV2_TP_README = 'https://github.com/stratum-mining/sv2-tp#readme';
const DMND_CLIENT_SETUP = 'https://github.com/dmnd-pool/dmnd-client#4-run-the-dmnd-client';
const DMND_JD_BLOCK = 'https://blog.dmnd.work/dmnd-mines-the-first-known-bitcoin-block-using-stratum-v2-job-declaration/';
const DMND_SIGNALING = 'https://blog.dmnd.work/miner-signaling-via-dmnd-stratum-v2-you-decide-what-to-signal/';
const DIRECT_CONNECTION_PATH = '/workers';
const MERGE_MINING_PATH = '/build-your-block/merge-mining';
const PRIORITIZE_TRANSACTIONS_PATH = '/build-your-block/prioritize-transactions';

const GUIDE_NAME = 'Job Declaration';
const BUILD_YOUR_BLOCK = 'BUILD YOUR BLOCK';
const BUILD_YOUR_BLOCK_PAGE = '/build-your-block';
const BASE_PATH = '/build-your-block/job-declaration';

const MINER_CONNECTION = 'stratum+tcp://<dmnd-client-machine-ip>:32767';

interface GuideSection {
  slug: string;
  title: string;
  navTitle?: string;
  group: string;
  step?: number;
  content: () => ReactNode;
}

const SECTIONS: GuideSection[] = [
  {
    slug: 'why',
    title: 'Build your own blocks with Job Declaration',
    navTitle: 'Why build your own block',
    group: 'Overview',
    content: () => (
      <>
        <DocLede>
          Mine with a pool without giving the pool control of your block. Your Bitcoin node builds the template; DMND
          validates declared job, accounts for shares, and pays you for pooled mining.
        </DocLede>
        <DocLede>
          Job Declaration is production infrastructure, not a demo. DMND mined the <a
            href={DMND_JD_BLOCK}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 underline underline-offset-4 hover:opacity-70'
          >first known Bitcoin block  </a> produced with Stratum V2 Job Declaration on mainnet. It also gives miners control over block
              signaling and DMND does not edit a miner's declared transaction selection or nVersion bits.
        </DocLede>

                <DocCallout label="See more about signaling">
                  <a
                    href={DMND_SIGNALING}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-4 hover:opacity-70"
                  >
                    Miner signaling via DMND Stratum V2: You decide what to signal
                    <LiArrowRightUp className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </DocCallout>
 

        <DocSection title="Why build your own block?" level={3}>
          <BlockPoints
            points={[
              {
                text: 'Choose the transactions and coinbase in the blocks your ASICs mine.',
                parts: ['coinbase', 'transactions'],
              },
              { text: 'Choose what your blocks signal through the nVersion field.', parts: 'version' },
              {
                text: 'Increase censorship resistance: no pool intermediary decides which transactions your template excludes.',
                parts: 'transactions',
              },
              { text: 'Strengthen Bitcoin decentralization by moving template construction from pools back to miners.' },
              { text: 'Reduce template latency by building fresh templates from your own local node.' },
              {
                text: 'Keep pooled mining economics: DMND remains responsible for validating declared jobs, accounting for shares, and paying you for the blocks your miners find.',
              },
            ]}
          />
          <DocText>
            Your ASICs do not need Stratum V2 firmware. They connect to the DMND Client with standard Stratum V1, while
            the client handles the SV2 and Job Declaration connection upstream.
          </DocText>
        </DocSection>

        <DocCallout label="Job Declaration is optional">
          Want the simplest path to mining with DMND? Use the managed pool endpoint and credentials on{' '}
          <Link href={DIRECT_CONNECTION_PATH} className="underline underline-offset-2 hover:text-foreground">
            Workers
          </Link>
          . Choose this setup when you want direct control over the block your miners work on.
        </DocCallout>

        <DocSection title="How the pieces fit together" level={3}>
          <StackDiagram />
          {/* The diagram carries names and ports; these say what each part is for. Ordered
              the way a template actually travels, which is not the order the drawing reads. */}
          <dl className="flex flex-col gap-2 pt-4">
            {[
              {
                name: 'Bitcoin Core',
                text: 'Your synchronized node holds the mempool and originates the templates.',
              },
              {
                name: 'sv2-tp',
                text: 'The Template Provider connects to Core through IPC and serves templates locally.',
              },
              {
                name: 'DMND Client',
                text: 'Your miners connect here. It receives templates and declares your custom work to DMND.',
              },
            ].map((part) => (
              <div key={part.name} className="text-sm leading-6">
                <dt className="inline font-medium text-heading">{part.name}</dt>
                <dd className="inline text-body-alt"> &mdash; {part.text}</dd>
              </div>
            ))}
          </dl>
        </DocSection>
      </>
    ),
  },
  {
    slug: 'node-and-template-provider',
    title: 'Run Bitcoin Core and the Template Provider',
    navTitle: 'Node and sv2-tp',
    group: 'Set it up',
    step: 1,
    content: () => (
      <>
        <DocText>
          Bitcoin Core holds your mempool and originates the templates. The Template Provider (<Chip>sv2-tp</Chip>)
          connects to it through IPC and serves those templates to the DMND Client.
        </DocText>

        <DocText>
          The <Chip>sv2-tp</Chip> README covers both halves of this step — running Bitcoin Core with IPC enabled, and
          running the Template Provider — and is kept up to date with each release:
        </DocText>
        <a
          href={SV2_TP_README}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
        >
          Set up Bitcoin Core and sv2-tp
          <LiArrowRightUp className="h-3.5 w-3.5" />
        </a>

        <DocText>
          The Template Provider listens on port <Chip>8336</Chip> by default, which is the address you give the DMND
          Client in the next step.
        </DocText>

        <DocCallout label="Match the versions">
          Current <Chip>sv2-tp</Chip> releases require Bitcoin Core <Chip>v31.0+</Chip>, because of breaking changes in
          the IPC mining interface. If you intentionally run Bitcoin Core <Chip>v30.2</Chip>, use the legacy{' '}
          <Chip>sv2-tp v1.0.6</Chip> release instead.
        </DocCallout>

      </>
    ),
  },
  {
    slug: 'dmnd-client',
    title: 'Run DMND Client and connect your miners',
    navTitle: 'DMND Client',
    group: 'Set it up',
    step: 2,
    content: () => (
      <>
        <DocText>
          Run the DMND Client with your DMND token and the Template Provider address. It connects upstream to DMND,
          receives your local templates, and exposes a standard Stratum V1 endpoint for your ASICs.
        </DocText>
        <a
          href={DMND_CLIENT_SETUP}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
        >
          Continue with DMND Client setup
          <LiArrowRightUp className="h-3.5 w-3.5" />
        </a>
        <DocText>Once the client is healthy, point each ASIC at the machine running it:</DocText>
        <CodeBlock code={MINER_CONNECTION} />
        <CommandLegend code={MINER_CONNECTION} />
        <DocList
          items={[
            'Use your DMND token as the miner password.',
            'Use any worker name, or leave the username empty.',
          ]}
        />
      </>
    ),
  },
  {
    slug: 'verify',
    title: 'Verify it is working',
    navTitle: 'Verify',
    group: 'Set it up',
    step: 3,
    content: () => (
      <>
        <DocCallout label="Bitcoin Core and the Template Provider" check>
          Bitcoin Core is fully synchronized, and the <Chip>sv2-tp</Chip> log shows a successful IPC connection and new
          templates as blocks arrive.
        </DocCallout>

        <DocCallout label="DMND Client and your miners" check>
          The DMND Client log shows connections to both <Chip>sv2-tp</Chip> and DMND, with templates being declared.
          Your miners connect normally and begin submitting shares.
        </DocCallout>
      </>
    ),
  },
  {
    slug: 'build-on-it',
    title: 'Build on your Job Declaration setup',
    navTitle: 'Build on it',
    group: 'Next',
    content: () => (
      <>
        <DocText>
          Once templates are declaring successfully, you can extend the block you control in two optional ways:
        </DocText>
        <div className="grid gap-4 lg:grid-cols-2">
          <Link
            href={MERGE_MINING_PATH}
            className="group flex flex-col gap-4 rounded-xl border-[0.5px] border-border bg-card p-5 transition-colors hover:border-info/50 sm:flex-row sm:gap-5"
          >
            <BlockDrawing highlight="coinbase" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-heading text-lg font-bold leading-6 tracking-[-0.5px] text-heading">
                Earn direct rBTC with merge mining
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium leading-5 text-foreground">
                Merge mining
                <LiAltArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
          <Link
            href={PRIORITIZE_TRANSACTIONS_PATH}
            className="group flex flex-col gap-4 rounded-xl border-[0.5px] border-border bg-card p-5 transition-colors hover:border-info/50 sm:flex-row sm:gap-5"
          >
            <BlockDrawing highlight="transactions" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-heading text-lg font-bold leading-6 tracking-[-0.5px] text-heading">
                Prioritize transactions in your templates
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium leading-5 text-foreground">
                Prioritize transactions
                <LiAltArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        </div>
      </>
    ),
  },
];

const STEP_COUNT = SECTIONS.filter((s) => s.step).length;
const sectionPath = (slug: string) => `${BASE_PATH}/${slug}`;
const sectionLabel = (s: GuideSection) => {
  const name = s.navTitle ?? s.title;
  return s.step ? `Step ${s.step}: ${name}` : name;
};

/**
 * Enable job declaration support: what a miner runs to build their own block templates.
 *
 * The Bitcoin Core version differs from the design, which says v30+. The Template
 * Provider's own release notes require v31.0 or later, and its last release supporting
 * v30.2 predates the current IPC changes, so following the drawn version would leave a
 * miner unable to connect.
 */
export function JobDeclarationPage() {
  const [, params] = useRoute(`${BASE_PATH}/:section`);
  const found = SECTIONS.findIndex((s) => s.slug === params?.section);
  const index = found === -1 ? 0 : found;
  const section = SECTIONS[index];
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  // Setting this up spans days, so a finished step stays finished across visits.
  const { ticked, toggle } = useGuideTicks('job-declaration-steps');

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.closest('main')?.scrollTo({ top: 0 });
  }, [index]);

  return (
    <div ref={root}>
      <DocPage
        trail={[
          { label: BUILD_YOUR_BLOCK, href: BUILD_YOUR_BLOCK_PAGE },
          { label: GUIDE_NAME, href: sectionPath(SECTIONS[0].slug) },
          { label: section.navTitle ?? section.title },
        ]}
      >
        {index === 0 && <DocHero src={heroImage} />}

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <DocSectionNav
            items={SECTIONS.map((s) => ({
              href: sectionPath(s.slug),
              label: s.navTitle ?? s.title,
              group: s.group,
              step: s.step,
              done: s.step !== undefined && ticked.includes(s.slug),
              active: s.slug === section.slug,
            }))}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:order-1">
            <DocSectionHeader step={section.step} stepCount={STEP_COUNT} title={section.title} />

            {section.content()}

            {section.step !== undefined && (
              <StepDone done={ticked.includes(section.slug)} onToggle={() => toggle(section.slug)} />
            )}

            <DocPager
              guide={GUIDE_NAME}
              prev={prev && { href: sectionPath(prev.slug), label: sectionLabel(prev) }}
              next={next && { href: sectionPath(next.slug), label: sectionLabel(next) }}
            />

            <DocFooterPrompt
              href={DMND_CLIENT_SETUP}
              title="Need the complete DMND Client setup?"
              description="Use the release-specific guide for client commands, endpoint overrides, and troubleshooting."
              linkLabel="Open the DMND Client guide"
            />
          </div>
        </div>
      </DocPage>
    </div>
  );
}
