import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/guide-hero-prioritize-transactions.png";
import {
  DocHero,
  DocSection,
  DocSectionHeader,
  DocSectionNav,
  DocPager,
  DocText,
  DocLede,
  DocTable,
  DocCallout,
  DocMarkedList,
  Chip,
  DocFooterPrompt,
} from "@/components/docs/DocPrimitives";
import {
  DocPage,
  StackSummary,
  CodeBlock,
  CommandLegend,
} from "@/components/docs/DocGuide";

const DMND_CLIENT_PRIORITIZATION =
  "https://github.com/dmnd-pool/dmnd-client#7-prioritize-transactions-optional";
const JOB_DECLARATION_PATH = "/build-your-block/job-declaration";

const CLI_EXAMPLE = `./dmnd-client -l info -d 250T --tp-address="127.0.0.1:8336" \\
  --token <DMND-token> \\
  --rpc-url http://127.0.0.1:8332 \\
  --rpc-user <bitcoin-rpc-user> \\
  --rpc-pwd <bitcoin-rpc-password> \\
  --rpc-fee-delta 100000 \\
  --api-tx-token <api-token>`;

const TOML_EXAMPLE = `rpc_url = "http://127.0.0.1:8332"
rpc_user = "<bitcoin-rpc-user>"
rpc_pwd = "<bitcoin-rpc-password>"
rpc_fee_delta = 100000
api_tx_token = "<api-token>"`;

const SUBMIT_EXAMPLE = `curl -X POST \\
  -H "Authorization: Bearer <api-token>" \\
  "http://127.0.0.1:3001/api/tx/submit/<raw-transaction-hex>"`;

const LIST_EXAMPLE = `curl \\
  -H "Authorization: Bearer <api-token>" \\
  "http://127.0.0.1:3001/api/tx/prioritized"`;

const RESPONSE_EXAMPLE = `{
  "success": true,
  "message": null,
  "data": {
    "count": 1,
    "txs": [
      {
        "txid": "<txid>",
        "tx_hex": "<raw-transaction-hex>",
        "tx_fee": {
          "real": 0.00001000,
          "modified": 0.00101000
        }
      }
    ]
  }
}`;

interface Setting {
  setting: string;
  flag: string;
  toml: string;
  env: string;
  description: React.ReactNode;
}

const SETTINGS: Setting[] = [
  {
    setting: "RPC URL",
    flag: "--rpc-url",
    toml: "rpc_url",
    env: "RPC_URL",
    description: (
      <>
        Bitcoin Core RPC, e.g. <Chip>http://127.0.0.1:8332</Chip>
      </>
    ),
  },
  {
    setting: "RPC user",
    flag: "--rpc-user",
    toml: "rpc_user",
    env: "RPC_USER",
    description: "Bitcoin Core RPC username",
  },
  {
    setting: "RPC password",
    flag: "--rpc-pwd",
    toml: "rpc_pwd",
    env: "RPC_PWD",
    description: "Bitcoin Core RPC password",
  },
  {
    setting: "Fee delta",
    flag: "--rpc-fee-delta",
    toml: "rpc_fee_delta",
    env: "RPC_FEE_DELTA",
    description: (
      <>
        Virtual fee boost in satoshis, passed to{" "}
        <Chip>prioritisetransaction</Chip>
      </>
    ),
  },
  {
    setting: "API token",
    flag: "--api-tx-token",
    toml: "api_tx_token",
    env: "API_TX_TOKEN",
    description: "Bearer token required by this API",
  },
];

function ConfigureBy({ aside }: { aside: ReactNode }) {
  // Ordered by precedence: a CLI flag beats the config file, which beats the environment.
  const [method, setMethod] = useState<"cli" | "toml" | "env">("cli");

  const methods = [
    { id: "cli" as const, label: "CLI flag", code: CLI_EXAMPLE },
    { id: "toml" as const, label: "config.toml", code: TOML_EXAMPLE },
    // Nothing to run for this one: the names are the whole answer, so it shows the table.
    { id: "env" as const, label: "Env var", code: null },
  ];
  const open = methods.find((m) => m.id === method)!;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Configuration method"
        className="inline-flex w-fit gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === method}
            onClick={() => setMethod(m.id)}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-sm leading-5 transition-colors",
              m.id === method
                ? "bg-background font-medium text-heading shadow-sm"
                : "text-body-alt hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[6fr_4fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {open.code ? (
            <>
              <CodeBlock code={open.code} />
              <CommandLegend code={open.code} />
            </>
          ) : (
            <DocTable
              headers={["Setting", "Env var", "Description"]}
              rows={SETTINGS.map((setting) => [
                setting.setting,
                <Chip>{setting.env}</Chip>,
                setting.description,
              ])}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">{aside}</div>
      </div>
    </div>
  );
}

const GUIDE_NAME = "Prioritize transactions";
const BUILD_YOUR_BLOCK = "BUILD YOUR BLOCK";
const BUILD_YOUR_BLOCK_PAGE = "/build-your-block";
const BASE_PATH = "/build-your-block/prioritize-transactions";

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
    slug: "set-it-up",
    title: "Add prioritization to your existing DMND Client",
    navTitle: "Set it up",
    group: "Prioritize transactions",
    step: 1,
    content: () => (
      <>
        <DocLede>
          Turn control of your block template into a service. Favor an eligible
          transaction in the template your own node builds—for fee recovery,
          private inclusion, or a paid inclusion workflow.
        </DocLede>

        <DocCallout label="Requires Job Declaration">
          This is the practical payoff of building your own blocks. Set up{" "}
          <Link
            href={JOB_DECLARATION_PATH}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Job Declaration
          </Link>{" "}
          first so the template belongs to your operation rather than the pool.
        </DocCallout>

        <DocSection title="What you need before you begin" level={3}>
          <StackSummary href={JOB_DECLARATION_PATH} />
        </DocSection>

        <DocSection title="How it works" level={3}>
          <DocMarkedList
            items={[
              <>
                The DMND Client exposes an API that submits a raw transaction to
                your Bitcoin Core node and asks it to prioritize that
                transaction for local block-template selection through the{" "}
                <Chip>prioritisetransaction</Chip> RPC.
              </>,
              "The virtual fee boost affects only template selection on your node; it does not spend anything or alter the transaction on the network.",
              "It is not a confirmation guarantee. The transaction still has to be valid, accepted by your node, selected into a template, and ultimately mined.",
              "The endpoint is optional and off by default, so it does not affect normal DMND Client operation unless you enable it.",
            ]}
          />
        </DocSection>

        <DocSection title="Configure the client" level={3}>
          <DocText>
            Keep your existing Job Declaration launch configuration and add all
            five settings below. You can set them by CLI flag,{" "}
            <Chip>config.toml</Chip>, or environment variable; CLI flags take
            precedence over the config file, which takes precedence over
            environment variables.
          </DocText>
          <DocText>
            The feature is enabled only when every setting is configured:
          </DocText>
          <ConfigureBy
            aside={
              <>
                <DocCallout label="Fee delta units:">
                  <Chip>RPC_FEE_DELTA</Chip> is denominated in satoshis. It's a
                  virtual fee adjustment used only for template selection on
                  your node — it doesn't spend anything <Chip>100000</Chip>{" "}
                  (0.001 BTC virtual boost) is a reasonable starting point.
                </DocCallout>

              </>
            }
          />
        </DocSection>

        <DocSection title="Security" level={3}>
          <DocMarkedList
            items={[
              <>
                The tx API (default port <Chip>3001</Chip>) should never be exposed to the public internet. Bind it to
                localhost or protect it behind your own gateway.
              </>,
              <>
                <Chip>config.toml</Chip> stores RPC credentials in plaintext — restrict file permissions (
                <Chip>chmod 600 config.toml</Chip>).
              </>,
              <>
                Treat <Chip>API_TX_TOKEN</Chip> like a password.
              </>,
            ]}
          />
        </DocSection>
      </>
    ),
  },
  {
    slug: "using-the-api",
    title: "Using the API",
    group: "Prioritize transactions",
    step: 2,
    content: () => (
      <>
        <DocText>Submit a raw transaction hex:</DocText>
        <CodeBlock code={SUBMIT_EXAMPLE} />

        <DocText>List currently tracked prioritized transactions:</DocText>
        <CodeBlock code={LIST_EXAMPLE} />

        <DocCallout label="Verify" check>
          After submitting a valid transaction, the list endpoint returns it
          with a <Chip>modified</Chip> fee above the transaction&rsquo;s{" "}
          <Chip>real</Chip> base fee. That confirms your node is tracking the
          local priority.
        </DocCallout>

        <DocText>
          The response includes the tracked transaction count, transaction hex,
          and live mempool fees from Bitcoin Core — <Chip>tx_fee.real</Chip> is{" "}
          <Chip>getmempoolentry</Chip>'s <Chip>fees.base</Chip>;{" "}
          <Chip>tx_fee.modified</Chip> is the boosted <Chip>fees.modified</Chip>
          :
        </DocText>
        <CodeBlock code={RESPONSE_EXAMPLE} />

        <DocText>
          The API server port defaults to <Chip>3001</Chip> and can be changed
          with <Chip>--api-server-port</Chip>, <Chip>api_server_port</Chip>, or{" "}
          <Chip>API_SERVER_PORT</Chip>.
        </DocText>

        <DocText>
          If the prioritization configuration is incomplete, these endpoints are
          disabled: the client logs that transaction prioritization is not
          enabled and the endpoints return <Chip>503 Service Unavailable</Chip>.
        </DocText>
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
 * Prioritize transactions: an optional DMND Client API that asks the miner's own
 * Bitcoin Core node to favour a transaction when building templates. The boost is
 * virtual, so it spends nothing and does not alter the transaction on the network.
 */
export function PrioritizeTransactionsPage() {
  const [, params] = useRoute(`${BASE_PATH}/:section`);
  const found = SECTIONS.findIndex((s) => s.slug === params?.section);
  const index = found === -1 ? 0 : found;
  const section = SECTIONS[index];
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  // Paging is a fresh page, not a scroll. The dashboard scrolls its <main>, not the window.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.closest("main")?.scrollTo({ top: 0 });
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
        {index === 0 && <DocHero src={heroImage} height={160} />}

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <DocSectionNav
            items={SECTIONS.map((s) => ({
              href: sectionPath(s.slug),
              label: s.navTitle ?? s.title,
              group: s.group,
              step: s.step,
              active: s.slug === section.slug,
            }))}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:order-1">
            <DocSectionHeader
              step={section.step}
              stepCount={STEP_COUNT}
              title={section.title}
            />

            {section.content()}

            <DocPager
              guide={GUIDE_NAME}
              prev={
                prev && {
                  href: sectionPath(prev.slug),
                  label: sectionLabel(prev),
                }
              }
              next={
                next && {
                  href: sectionPath(next.slug),
                  label: sectionLabel(next),
                }
              }
            />

            <DocFooterPrompt
              href={DMND_CLIENT_PRIORITIZATION}
              title="Need the release-specific API reference?"
              description="Use the DMND Client guide for the current configuration flags and transaction-priority behavior."
              linkLabel="Open prioritization reference"
            />
          </div>
        </div>
      </DocPage>
    </div>
  );
}
