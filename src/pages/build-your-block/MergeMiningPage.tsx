import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { LiArrowRightUp, LiAltArrowDown } from 'solar-icon-react/li';
import { BoInfoCircle } from 'solar-icon-react/bo';
import heroImage from '@/assets/guide-hero-merge-mining.png';
import {
  DocHero,
  DocSection,
  DocSectionHeader,
  DocSectionNav,
  DocLede,
  DocText,
  DocList,
  DocTable,
  DocCallout,
  DocPager,
  Chip,
  DocFooterPrompt,
} from '@/components/docs/DocPrimitives';
import {
  DocPage,
  StackSummary,
  GuidePrereqs,
  StepDone,
  useGuideTicks,
  CodeBlock,
} from '@/components/docs/DocGuide';

const DMND_CLIENT_MERGE_MINING = 'https://github.com/dmnd-pool/dmnd-client/blob/master/MERGE_MINING.md';
const RUST_INSTALL = 'https://www.rust-lang.org/tools/install';
const JOB_DECLARATION_PAGE = '/build-your-block/job-declaration';
const BUILD_YOUR_BLOCK_PAGE = '/build-your-block';

const GUIDE_NAME = 'Merge mining';
const BUILD_YOUR_BLOCK = 'BUILD YOUR BLOCK';
const BASE_PATH = '/build-your-block/merge-mining';

const CLIENT_RUN = `API_BIND_ADDRESS=127.0.0.1 \\
API_SECRET=<shared-secret> \\
TOKEN=<DMND-token> \\
./dmnd-client -l info -d 250T --tp-address="127.0.0.1:8336"`;

const RSK_REWARD_ADDRESS = 'reward.address = "<your-RSK-address>"';

const RSKJ_RUN = `docker run --rm \\
  -e RSKJ_SYS_PROPS='-Drpc.providers.web.http.bind_address=127.0.0.1 \\
    -Drpc.modules.mnr.version=1.0 -Drpc.modules.mnr.enabled=true \\
    -Dminer.server.enabled=true -Dminer.reward.address=<your-RSK-address>' \\
  rsksmart/rskj:VETIVER-9.0.3`;

const BRIDGE_BUILD = 'cargo build --release -p demand-rsk-op-return-bridge';

const BRIDGE_RUN = `RSK_RPC_URL=http://127.0.0.1:4444 \\
DMND_CLIENT_API_SECRET=<strong-random-shared-secret> \\
DMND_CLIENT_OP_RETURN_URL=http://127.0.0.1:3001/api/coinbase/op-return \\
DMND_CLIENT_FOUND_JOB_URL=http://127.0.0.1:3001/api/merge-mining/found-job \\
./target/release/demand-rsk-op-return-bridge`;

const SUCCESS_ENVELOPE = `{
  "success": true,
  "message": null,
  "data": {}
}`;

const ERROR_ENVELOPE = `{
  "success": false,
  "message": "human-readable error",
  "data": null
}`;

const OP_RETURN_REQUEST = `POST /api/coinbase/op-return
Content-Type: application/json`;

const OP_RETURN_BODY = `{
  "secret": "shared-api-secret",
  "data_hex": "52534b424c4f434b3a000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "rsk_target_hex": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
}`;

const OP_RETURN_ACCEPTED = `{
  "success": true,
  "message": null,
  "data": {
    "payload_len_bytes": 41,
    "tx_out_len_bytes": 52,
    "replaced_pending": false
  }
}`;

const FOUND_JOB_REQUEST = 'GET /api/merge-mining/found-job?secret=shared-api-secret';

const FOUND_JOB_EMPTY = `{
  "success": true,
  "message": null,
  "data": null
}`;

const FOUND_JOB_BODY = `{
  "success": true,
  "message": null,
  "data": {
    "id": 42,
    "observed_at_unix_ts": 1784116800,
    "template_id": 9001,
    "version": 536870912,
    "header_timestamp": 1784116798,
    "header_nonce": 123456,
    "bitcoin_block_hash_hex": "<64 lowercase hex characters>",
    "block_header_hex": "<160 lowercase hex characters>",
    "coinbase_tx_hex": "<witness-stripped transaction hex>",
    "merkle_hashes_hex": [
      "<64 lowercase hex characters per sibling>"
    ],
    "block_tx_count": 2048,
    "op_return_payload_hex": "<82 lowercase hex characters>",
    "rsk_target_hex": "<64 lowercase hex characters>"
  }
}`;

const RAW_SELECTION = `p = last byte position of ASCII "RSKBLOCK:" in C
p must exist
C[p .. p + 41] must equal "RSKBLOCK:" || H
C.length - (p + 41) must be <= 128`;

const GET_WORK = `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "mnr_getWork",
  "params": []
}`;

const PARTIAL_MERKLE_CALL = `mnr_submitBitcoinBlockPartialMerkle(
    work_hash_without_the_RSKBLOCK_tag,
    block_header_hex,
    witness_stripped_coinbase_tx_hex,
    "<coinbase txid> <sibling 1> <sibling 2> ...",
    lowercase_hex_block_tx_count_without_0x
)`;

const PARTIAL_MERKLE_PARAMS = `[
  "<64-char work hash>",
  "<160-char header>",
  "<coinbase transaction>",
  "<coinbase txid> <sibling 1> <sibling 2>",
  "800"
]`;

const RAW_BLOCK = 'raw_block_hex = block_header_hex || "01" || coinbase_tx_hex';

const SUBMIT_BLOCK = 'mnr_submitBitcoinBlock(raw_block_hex)';

/** The RFC-style keywords the wire contract is written in. */
function Must({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

interface GuideSection {
  /** The URL segment under `/build-your-block/merge-mining`. */
  slug: string;
  title: string;
  /** Short form for the nav and pager, where a full headline will not fit. */
  navTitle?: string;
  /** The heading it is filed under in the section nav, in this order. */
  group: string;
  /** Set on the setup steps; it numbers them and nothing else. */
  step?: number;
  content: () => ReactNode;
}


const TROUBLE: { step: number; issue: ReactNode; check: ReactNode }[] = [
  {
    step: 1,
    issue: (
      <>
        <Chip>503 Service Unavailable</Chip> from the client
      </>
    ),
    check: (
      <>
        Confirm a non-empty <Chip>API_SECRET</Chip> is set on the client.
      </>
    ),
  },
  {
    step: 1,
    issue: 'Connection refused on port 3001',
    check: 'Check the client’s API port, bind address, and local firewall. Do not fix this by exposing the port.',
  },
  {
    step: 1,
    issue: (
      <>
        RskJ reports <Chip>method not found</Chip>
      </>
    ),
    check: (
      <>
        Enable the <Chip>mnr</Chip> module and the miner server, then restart RskJ.
      </>
    ),
  },
  {
    step: 2,
    issue: (
      <>
        <Chip>401 Unauthorized</Chip> from the client
      </>
    ),
    check: (
      <>
        <Chip>DMND_CLIENT_API_SECRET</Chip> must exactly match the client&rsquo;s <Chip>API_SECRET</Chip>.
      </>
    ),
  },
  {
    step: 2,
    issue: 'Jobs expire immediately',
    check: (
      <>
        Check UTC clock sync between hosts and <Chip>FOUND_JOB_MAX_AGE_SECS</Chip>.
      </>
    ),
  },
  { step: 2, issue: 'Repeated rate-limit messages', check: 'Let the bridge cooldown finish, then review the RskJ rate-limit policy.' },
  {
    step: 2,
    issue: 'Repeated transport timeouts',
    check: 'Check the route, service health, and proxy bypass. The client uses 5s connect / 20s request timeouts.',
  },
  {
    step: 4,
    issue: 'Work is fetched but no RSK jobs reach miners',
    check: 'Confirm RskJ is synced, the client is in Job Declaration mode, and its Template Provider is serving new templates.',
  },
];

/** The issues for one step, closed until something has gone wrong. */
function StepTrouble({ step }: { step: number }) {
  const rows = TROUBLE.filter((t) => t.step === step);
  if (!rows.length) return null;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border-[0.5px] border-border bg-muted px-4 py-3 text-sm leading-5 text-foreground transition-colors hover:border-placeholder [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <BoInfoCircle className="h-4 w-4 shrink-0 text-placeholder" />
          Troubleshooting
        </span>
        <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-3">
        <DocTable headers={['Issue', 'Check']} rows={rows.map((t) => [t.issue, t.check])} />
      </div>
    </details>
  );
}

const MERGE_MINING_EXTRA = [
  {
    id: 'rust',
    name: (
      <>
        A Rust 2024 toolchain to build the bridge.{' '}
        <a
          href={RUST_INSTALL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline underline-offset-4 hover:opacity-70"
        >
          Install Rust
          <LiArrowRightUp className="h-3.5 w-3.5" />
        </a>
      </>
    ),
    label: 'A Rust 2024 toolchain to build the bridge.',
  },
  {
    id: 'supervisor',
    name: 'A process supervisor (systemd, Docker Compose) that restarts the bridge on its own, independently of the client and the pool.',
  },
  {
    id: 'rskj',
    label: 'RskJ node',
    coveredNext: true,
    name: (
      <>
        A synchronized RskJ node on mainnet, release <Chip>VETIVER-9.0.3</Chip>, with the <Chip>mnr</Chip> RPC module
        and the miner server enabled and the node fully synced. There is no testnet pool endpoint, so RSK merge mining
        runs on mainnet.
      </>
    ),
  },
  {
    id: 'client-build',
    label: 'DMND Client build with merge-mining support',
    coveredNext: true,
    name: (
      <>
        A DMND Client build with merge-mining support. The published <Chip>v0.3.28</Chip> release predates the feature
        and will not work, so until a release ships with it merged, build and pin the reviewed commit{' '}
        <Chip>b1d46b306f1415770e2dba9232aa47d6ca335999</Chip> (package <Chip>0.3.29</Chip>) or a later reviewed
        revision that keeps the same contract.
      </>
    ),
  },
  {
    id: 'clocks',
    coveredNext: true,
    name: 'Both hosts synchronized to UTC, because the bridge expires jobs using the client’s timestamps and clock drift makes jobs look stale.',
  },
];

/**
 * The guide, one section per page.
 *
 * The operator path comes first: what the miner gets, readiness, setup, security,
 * verification, and support.
 *
 * The last three are the wire contract from the client's MERGE_MINING.md. They are for
 * anyone writing their own bridge rather than running the companion one, so they are placed
 * under Advanced, collapsed, and not part of the main operator path.
 */
const SECTIONS: GuideSection[] = [
  {
    slug: 'earn-rbtc',
    title: 'Add direct rBTC rewards to the blocks you already build',
    navTitle: 'Earn rBTC',
    group: 'Overview',
    content: () => (
      <>
        <DocLede>
          Your Job Declaration setup already puts the coinbase in your hands. Add a Rootstock commitment and earn rBTC
          to an address you control using the same ASICs and Bitcoin hash rate—without changing your Bitcoin mining
          path.
        </DocLede>

        <DocCallout label="An optional upgrade to Job Declaration">
          Merge mining adds an RskJ node and bridge service, but requires no new ASIC hardware or firmware.
        </DocCallout>

        <DocSection title="Before you start" level={3}>
          <StackSummary href={JOB_DECLARATION_PAGE} />
          <DocText>On top of that stack you need:</DocText>
          <GuidePrereqs
            items={MERGE_MINING_EXTRA}
            storageKey="merge-mining"
            coveredNextHref={sectionPath('configuration')}
          />
        </DocSection>
      </>
    ),
  },
  {
    slug: 'configuration',
    title: 'Prepare the DMND Client and RskJ',
    group: 'Set it up',
    step: 1,
    content: () => (
      <>
        <DocSection title="Configure the DMND Client" level={3}>
          <DocText>
            The bridge talks to the client over a small protected API, so bind that API to loopback and give it a
            strong, dedicated secret. The client&rsquo;s default API bind is not loopback, so set it explicitly:
          </DocText>
          <CodeBlock code={CLIENT_RUN} />
          <DocText>
            This is the same client run line from the setup guide with the merge-mining API switched on. The API
            defaults to port 3001 (<Chip>--api-server-port</Chip>, short form <Chip>-s</Chip>). The secret you set here
            has to match the one you give the bridge in the next step.
          </DocText>
          <DocCallout label="Verify" check>
            The client is running in Job Declaration mode, declaring templates to the pool, with the API listening on{' '}
            <Chip>127.0.0.1:3001</Chip>.
          </DocCallout>
        </DocSection>

        <DocSection title="Configure RskJ" level={3}>
          <DocText>
            The setting that matters most is where you get paid. rBTC rewards go to an RSK address configured on your
            node, so for a live mainnet deployment, set an explicit address you control:
          </DocText>
          <CodeBlock code={RSK_REWARD_ADDRESS} />
          <DocText>
            The alternative, <Chip>miner.coinbase.secret</Chip>, is a passphrase RskJ uses to derive an address into a
            local wallet; RSK does not recommend it for production, so treat it as testing only. This setting is
            separate from the client API secret and does not need to match it. Rewards arrive through RSK&rsquo;s Reward
            Manager (REMASC) after a maturity delay, not the instant a block is found, so an empty balance right after
            your first block is not a failure. Think of RSK as a bonus on the same work, not a second full income
            stream.
          </DocText>
          <DocText>
            Beyond the payout address, RskJ has to expose HTTP RPC with the <Chip>mnr</Chip> module and the miner server
            on. The example below binds the RPC listener to loopback and runs on mainnet. Treat it as a starting point:
            for a real deployment, follow the official RskJ node docs and manage node configuration through a protected
            service setup rather than ad hoc command lines.
          </DocText>
          <CodeBlock code={RSKJ_RUN} />
          <DocText>Three settings carry the work here:</DocText>
          <DocList
            items={[
              <>
                <Chip>rpc.modules.mnr.enabled=true</Chip> exposes <Chip>mnr_getWork</Chip>,{' '}
                <Chip>mnr_submitBitcoinBlock</Chip>, and <Chip>mnr_submitBitcoinBlockPartialMerkle</Chip>.
              </>,
              <>
                <Chip>miner.server.enabled=true</Chip> is required for <Chip>mnr_getWork</Chip>.
              </>,
              <>
                <Chip>RSK_RPC_URL</Chip>, set on the bridge in the next step, must point at this listener, normally{' '}
                <Chip>http://127.0.0.1:4444</Chip>.
              </>,
            ]}
          />
          <DocText>
            Leave the bind address on loopback rather than <Chip>0.0.0.0</Chip>.
          </DocText>
          <DocCallout label="Verify" check>
            The node is synced and <Chip>mnr_getWork</Chip> responds over the RPC listener.
          </DocCallout>
        </DocSection>
      </>
    ),
  },
  {
    slug: 'run-the-bridge',
    title: 'Build and run the bridge',
    group: 'Set it up',
    step: 2,
    content: () => (
      <>
        <DocText>
          Build the bridge from <a
            href="https://github.com/dmnd-pool/demand-rsk-op-return-bridge"
            target='_blank'
            rel='noopener noreferrer'
            className='underline underline-offset-2 hover:text-foreground'
          >this repo</a>
        </DocText>
        <CodeBlock code={BRIDGE_BUILD} />
        <DocText>Then run it with its environment configured through your supervisor:</DocText>
        <CodeBlock code={BRIDGE_RUN} />
        <DocText>
          Only two variables are required: <Chip>RSK_RPC_URL</Chip> and <Chip>DMND_CLIENT_API_SECRET</Chip> (which must
          exactly match the client&rsquo;s <Chip>API_SECRET</Chip>). Everything else has a sane default:
        </DocText>
        <DocTable
          headers={['Variable', 'Required', 'Default', 'Purpose']}
          rows={[
            [<Chip>RSK_RPC_URL</Chip>, 'Yes', 'none', 'Protected RskJ HTTP RPC listener.'],
            [
              <Chip>DMND_CLIENT_API_SECRET</Chip>,
              'Yes',
              'none',
              <>
                Must exactly match the client <Chip>API_SECRET</Chip>.
              </>,
            ],
            [
              <Chip>DMND_CLIENT_OP_RETURN_URL</Chip>,
              'No',
              <Chip>http://127.0.0.1:3001/api/coinbase/op-return</Chip>,
              'Where the RSK commitment is posted.',
            ],
            [
              <Chip>DMND_CLIENT_FOUND_JOB_URL</Chip>,
              'No',
              'Derived from the OP_RETURN URL',
              'Where found jobs are polled. Set explicitly if the OP_RETURN URL is custom.',
            ],
            [<Chip>RSK_POLL_INTERVAL_SECS</Chip>, 'No', <Chip>1</Chip>, 'How often to poll RskJ for work.'],
            [
              <Chip>FOUND_JOB_POLL_INTERVAL_SECS</Chip>,
              'No',
              <Chip>1</Chip>,
              'How often to poll the client for found jobs.',
            ],
            [<Chip>JOB_RETRY_INTERVAL_SECS</Chip>, 'No', <Chip>5</Chip>, 'Delay between submission retries.'],
            [<Chip>FOUND_JOB_MAX_AGE_SECS</Chip>, 'No', <Chip>600</Chip>, 'Oldest job age still worth submitting.'],
            [
              <Chip>DMND_CLIENT_WORK_RESYNC_INTERVAL_SECS</Chip>,
              'No',
              <Chip>60</Chip>,
              'Idempotent repost of unchanged work.',
            ],
            [<Chip>MAX_PENDING_FOUND_JOBS</Chip>, 'No', <Chip>256</Chip>, 'Proofs held in bridge memory.'],
          ]}
        />
        <DocText>
          The binary loads a local <Chip>.env</Chip> file if one exists. A configuration error exits with status 2;
          runtime RPC and HTTP errors are logged and retried, because temporary RskJ failures are expected.
        </DocText>
        <DocText>
          Run the bridge and the client as separate supervised processes with independent restart policies. A bridge
          crash must not restart the client. When the client restarts, restart the bridge once the client API is healthy
          so it reposts the current RSK work; reconnects inside a still-running client process keep the desired pair on
          their own. Keep both hosts synchronized to UTC with NTP or chrony, since proof expiry uses the client&rsquo;s
          timestamp.
        </DocText>
      </>
    ),
  },
  {
    slug: 'security',
    title: 'Secure the control plane',
    group: 'Set it up',
    step: 3,
    content: () => (
      <>
        <DocText>The bridge model only holds if the control plane stays private.</DocText>
        <DocList
          items={[
            <>
              Neither the client API nor the RskJ RPC listener may face the public internet. Run RskJ, the bridge, and
              the client on one host with both listeners bound to <Chip>127.0.0.1</Chip>; across hosts, carry the
              traffic over an authenticated private tunnel (TLS/mTLS or an encrypted network). A private IP by itself is
              not authentication.
            </>,
            <>
              <Chip>API_SECRET</Chip> is application authentication, not a network perimeter. It proves the caller; it
              does not firewall the port.
            </>,
            'The found-job request carries the secret in its URL query string. Any proxy, access log, or APM in front of these services must redact full request targets and query strings. Never put the secret, tokens, or credentials in an endpoint URL.',
            'Keep secrets distinct. The client API secret, the RskJ miner secret, and your mining token are three different things. Do not reuse one for another.',
          ]}
        />
      </>
    ),
  },
  {
    slug: 'verify-it-is-working',
    title: 'Verify it is working',
    group: 'Set it up',
    step: 4,
    content: () => (
      <>
        <DocText>
          The bridge exposes no health endpoint, so you monitor it through its process and its logs. Healthy operation
          shows three log lines:
        </DocText>
        <DocList
          items={[
            <>
              <Chip>queued RSK merge-mining payload into dmnd-client</Chip> — new or resynced RSK work was accepted by
              the client.
            </>,
            <>
              <Chip>queued found merge-mining job for RSK submission</Chip> — a miner found a qualifying share
              (naturally rare).
            </>,
            <>
              <Chip>submitted merge-mined Bitcoin block to RSK</Chip> — RskJ accepted a submission.
            </>,
          ]}
        />
        <DocText>
          The submission log tags a <Chip>submission_mode</Chip>: <Chip>partial-merkle</Chip> for a multi-transaction
          block, <Chip>coinbase-only-block</Chip> for a one-transaction block. Found-job and submission logs are sparse
          by nature, so their absence alone does not mean the bridge is broken, only that no RSK-qualified share has
          come up yet.
        </DocText>
        <DocText>
          Your logs may contain job IDs, template IDs, and work hashes, but never API secrets, POST authentication
          bodies, or full found-job request targets — sanitize before sharing.
        </DocText>
        <DocCallout label="Setup complete" check>
          Once the first line appears, merge mining is running and there is nothing left to configure. The other two
          follow on their own, whenever a share qualifies.
        </DocCallout>
      </>
    ),
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    group: 'Support',
    content: () => (
      <>
        <DocTable headers={['issue', 'Check']} rows={TROUBLE.map((t) => [t.issue, t.check])} />
        <DocText>
          <Chip>RUST_LOG=debug</Chip> helps temporarily, but debug output carries extra work and proof metadata and must
          follow the same log-handling rules.
        </DocText>
        <DocText>
          RSK merge mining is live, and it is opt-in and off by default, so turning it on is your choice. It runs
          against the specific reviewed builds named in the prerequisites, and none of it goes near your Bitcoin block
          submission path, so if the RSK side ever pauses, your Bitcoin mining keeps running untouched.
        </DocText>
        <DocText>
          Keep an eye on the client README. The canonical, always-current merge-mining reference lives at{' '}
          <Chip>github.com/dmnd-pool/dmnd-client</Chip>. Releases move regularly, so if a flag, port, endpoint, or
          commit ever differs from what you read here, the README is the source of truth.
        </DocText>
      </>
    ),
  },
  {
    slug: 'known-limitation',
    title: 'Known miner-target limitation',
    group: 'Support',
    content: () => (
      <>
        <DocText>
          The client deliberately never lowers a miner&rsquo;s normal Bitcoin share difficulty. It evaluates every
          authenticated, structurally valid share it receives before the normal Bitcoin-difficulty filter, so an
          RSK-valid submitted share is not hidden by a harder upstream filter.
        </DocText>
        <DocText>
          An ASIC, however, reports only hashes that satisfy the target assigned to it. If the RSK target is easier than
          the miner&rsquo;s assigned target, some hashes can satisfy RSK while never being submitted by the ASIC. The
          client and bridge cannot observe or recover those hashes.
        </DocText>
        <DocText>
          This is an intentional stability-first policy: merge mining does not change miner traffic or normal Bitcoin
          difficulty. It is a known deviation from a design that guarantees observation of every RSK-valid hash. A
          bridge implementation cannot remove this limitation.
        </DocText>
        <DocCallout label="Operator setup is complete" check>
          You have reached the end of the operator guide. Return to{' '}
          <Link href={BUILD_YOUR_BLOCK_PAGE} className="underline underline-offset-2 hover:text-foreground">
            Build your block
          </Link>{' '}
          or open the advanced bridge contract only if you are writing or hardening a bridge of your own.
        </DocCallout>
        <Link
          href={sectionPath('http-contract')}
          className="inline-flex w-fit items-center text-sm text-foreground underline underline-offset-4 hover:opacity-70"
        >
          Open advanced bridge documentation
        </Link>
      </>
    ),
  },
  {
    slug: 'http-contract',
    title: 'Bridge-facing HTTP contract',
    group: 'Advanced',
    content: () => (
      <>
        <DocCallout label="For bridge authors">
          This section and the two that follow define the wire contract a bridge must satisfy. The companion{' '}
          <Chip>demand-rsk-op-return-bridge</Chip> already implements it, so skip them if you are running that bridge.
        </DocCallout>
        <DocText>Both endpoints use JSON and the envelope:</DocText>
        <CodeBlock code={SUCCESS_ENVELOPE} />
        <DocText>An application error uses:</DocText>
        <CodeBlock code={ERROR_ENVELOPE} />
        <DocText>
          A bridge <Must>MUST</Must> treat a non-2xx status, malformed JSON, <Chip>success: false</Chip>, or missing
          required success data as a failed call.
        </DocText>

        <DocSection title="Set the desired payload and target" level={3}>
          <CodeBlock code={OP_RETURN_REQUEST} />
          <CodeBlock code={OP_RETURN_BODY} />
          <DocText>Request fields:</DocText>
          <DocTable
            headers={['Field', 'Requirements']}
            rows={[
              [
                <Chip>secret</Chip>,
                <>
                  Exact value of the client&rsquo;s non-empty <Chip>API_SECRET</Chip>
                </>,
              ],
              [
                <Chip>data_hex</Chip>,
                <>
                  Non-empty, even-length hex without <Chip>0x</Chip>, maximum 80 decoded bytes
                </>,
              ],
              [
                <Chip>rsk_target_hex</Chip>,
                <>
                  Exactly 32 bytes of big-endian display hex; <Chip>0x</Chip> or <Chip>0X</Chip> is accepted
                </>,
              ],
            ]}
          />
          <DocText>
            The generic endpoint accepts payloads up to 80 bytes, but only exactly <Chip>RSKBLOCK:</Chip> followed by
            one 32-byte work hash can produce RSK proof jobs. That 32-byte hash must not itself contain the nine-byte{' '}
            <Chip>RSKBLOCK:</Chip> marker, because RskJ selects the last raw marker in the coinbase.
          </DocText>
          <DocText>
            Success is <Chip>202 Accepted</Chip> after the pair has been stored atomically:
          </DocText>
          <CodeBlock code={OP_RETURN_ACCEPTED} />
          <DocText>
            <Chip>replaced_pending</Chip> is true whenever any desired pair was already stored, including an identical
            pair. Reposting is valid and does not duplicate a commitment in one template. An HTTP{' '}
            <Chip>202 Accepted</Chip> does not prove that an RSK job was sent to miners; it means only that the pair is
            stored and available for a subsequent compatible <Chip>NewTemplate</Chip>.
          </DocText>
          <DocText>Actual error statuses are:</DocText>
          <DocTable
            headers={['Status', 'Meaning', 'State change']}
            rows={[
              [
                <Chip>400 Bad Request</Chip>,
                'Missing/invalid target, malformed or ambiguous RSK payload, or output cannot be represented',
                'None',
              ],
              [<Chip>401 Unauthorized</Chip>, 'Wrong secret', 'None'],
              [
                <Chip>503 Service Unavailable</Chip>,
                <>
                  <Chip>API_SECRET</Chip> is absent/empty or the RSK observer/state is unavailable
                </>,
                'None',
              ],
            ]}
          />
        </DocSection>

        <DocSection title="Poll one found job" level={3}>
          <CodeBlock code={FOUND_JOB_REQUEST} />
          <DocText>An empty queue is successful:</DocText>
          <CodeBlock code={FOUND_JOB_EMPTY} />
          <DocText>A non-empty response contains one job:</DocText>
          <CodeBlock code={FOUND_JOB_BODY} />
          <DocText>Field requirements:</DocText>
          <DocTable
            headers={['Field', 'Contract']}
            rows={[
              [<Chip>id</Chip>, 'Positive identifier unique during this client process lifetime'],
              [<Chip>observed_at_unix_ts</Chip>, 'UTC Unix seconds when the client observed the share'],
              [<Chip>template_id</Chip>, 'Exact Template Distribution template used for reconstruction'],
              [<Chip>version</Chip>, 'Submitted Bitcoin header version; diagnostic'],
              [<Chip>header_timestamp</Chip>, 'Submitted header timestamp; diagnostic'],
              [<Chip>header_nonce</Chip>, 'Submitted header nonce; diagnostic'],
              [<Chip>bitcoin_block_hash_hex</Chip>, 'Exactly 32 bytes in standard Bitcoin display order'],
              [<Chip>block_header_hex</Chip>, 'Exactly 80 consensus-serialized Bitcoin header bytes'],
              [<Chip>coinbase_tx_hex</Chip>, 'One valid witness-stripped Bitcoin transaction'],
              [<Chip>merkle_hashes_hex</Chip>, 'Coinbase sibling hashes only, in the format below'],
              [
                <Chip>block_tx_count</Chip>,
                <>
                  Total block transactions including coinbase, <Chip>1..=2147483647</Chip>
                </>,
              ],
              [<Chip>op_return_payload_hex</Chip>, 'Exact applied 41-byte RSK payload'],
              [<Chip>rsk_target_hex</Chip>, 'Exact applied 32-byte big-endian display target'],
            ]}
          />
          <DocText>
            The GET is a destructive FIFO operation: <Chip>200</Chip> with an object atomically removes that object.{' '}
            <Chip>200</Chip> with <Chip>data: null</Chip> means empty. Authentication or internal failures do not
            intentionally pop an item.
          </DocText>
          <DocText>
            Delivery is at-most-once. If the HTTP response is lost after the client removes the item, the client does
            not deliver it again. A bridge therefore owns a job as soon as it receives a successful object and{' '}
            <Must>MUST</Must> keep that job in its own bounded retry state until RskJ accepts it, the job expires, or a
            terminal error makes it unusable.
          </DocText>
          <DocText>
            An ambiguous GET failure must not be treated as a retry of the same queue item: a later GET may pop the next
            item because the first may already have been removed. The bridge should continue normal polling and accept
            that the response-lost candidate is unrecoverable. It should also ignore unknown response fields so additive
            changes remain compatible.
          </DocText>
        </DocSection>
      </>
    ),
  },
  {
    slug: 'byte-order-and-validation',
    title: 'Byte order and proof validation',
    group: 'Advanced',
    content: () => (
      <>
        <DocText>
          A production bridge <Must>MUST</Must> validate a found job before submitting it to RskJ. At minimum:
        </DocText>
        <DocList
          items={[
            'normalize all fixed-width hashes to lowercase 64-character hex;',
            <>
              require an 80-byte <Chip>block_header_hex</Chip> and recompute its double-SHA256 display hash;
            </>,
            <>
              require the recomputed hash to equal <Chip>bitcoin_block_hash_hex</Chip>;
            </>,
            <>
              require the numeric block hash to be less than or equal to <Chip>rsk_target_hex</Chip>;
            </>,
            'deserialize exactly one coinbase transaction and reject witness-bearing serialization;',
            <>
              require the expected payload to be the last canonical <Chip>RSKBLOCK:</Chip> output and to start at the
              last raw tag in the witness-stripped serialization;
            </>,
            'compute the witness-stripped coinbase txid;',
            'reconstruct the merkle root and compare it with the header;',
            'validate the transaction count and exact sibling count; and',
            'require at most 128 bytes after the selected 32-byte RSK work hash.',
          ]}
        />
        <DocText>
          The companion <Chip>demand-rsk-op-return-bridge</Chip> is interoperable with the current client, but it does
          not yet perform every independent check above. In particular, it trusts the client and RskJ for the
          header-hash, last-commitment, and reconstructed-merkle-root checks. A new production bridge should not copy
          that trust shortcut unless the client connection is inside the same trusted failure domain; RskJ rejection
          still affects only merge-mining submission and never Bitcoin processing.
        </DocText>

        <DocSection title="Header layout" level={3}>
          <DocText>
            <Chip>block_header_hex</Chip> is the normal Bitcoin consensus header:
          </DocText>
          <DocTable
            headers={['Bytes', 'Value', 'Encoding']}
            rows={[
              [
                <Chip>0..4</Chip>,
                'version',
                <>
                  little-endian <Chip>u32</Chip>
                </>,
              ],
              [<Chip>4..36</Chip>, 'previous block hash', 'raw Bitcoin header byte order'],
              [<Chip>36..68</Chip>, 'merkle root', 'raw Bitcoin header byte order'],
              [
                <Chip>68..72</Chip>,
                'timestamp',
                <>
                  little-endian <Chip>u32</Chip>
                </>,
              ],
              [
                <Chip>72..76</Chip>,
                <Chip>nBits</Chip>,
                <>
                  little-endian <Chip>u32</Chip>
                </>,
              ],
              [
                <Chip>76..80</Chip>,
                'nonce',
                <>
                  little-endian <Chip>u32</Chip>
                </>,
              ],
            ]}
          />
          <DocText>
            The raw <Chip>SetNewPrevHash.prev_hash</Chip> bytes are already in header order and must not be reversed
            again. <Chip>bitcoin_block_hash_hex</Chip> and <Chip>rsk_target_hex</Chip> are fixed-width, big-endian
            display values.
          </DocText>
        </DocSection>

        <DocSection title="Merkle siblings" level={3}>
          <DocText>
            <Chip>merkle_hashes_hex</Chip> contains:
          </DocText>
          <DocList
            items={[
              'siblings only, never the coinbase txid;',
              'bottom-up order from the coinbase leaf to the root;',
              'one 32-byte lowercase string per sibling;',
              'standard Bitcoin display order, reversed from the raw SV2 merkle-path bytes; and',
              <>
                exactly the tree height obtained by repeatedly applying <Chip>width = ceil(width / 2)</Chip> until one
                node remains.
              </>,
            ]}
          />
          <DocText>
            For <Chip>block_tx_count == 1</Chip>, the array must be empty and the header merkle root must equal the
            witness-stripped coinbase txid.
          </DocText>
        </DocSection>

        <DocSection title="RskJ raw commitment selection" level={3}>
          <DocText>
            Let <Chip>C</Chip> be the complete witness-stripped consensus serialization of the coinbase and{' '}
            <Chip>H</Chip> the 32-byte work hash from this found job. A compatible producer or validating bridge must
            apply:
          </DocText>
          <CodeBlock code={RAW_SELECTION} />
          <DocText>
            The scan is byte-oriented across all fields and scripts; a marker can therefore occur in a non-OP_RETURN
            script or span a serialization boundary. Witness bytes are excluded. The bound is inclusive: 128 trailing
            bytes pass and 129 fail. The client separately requires its intended output to use the canonical OP_RETURN
            form before it publishes RSK-bound work.
          </DocText>
        </DocSection>
      </>
    ),
  },
  {
    slug: 'rskj-contract',
    title: 'RskJ-facing bridge contract',
    group: 'Advanced',
    content: () => (
      <>
        <DocSection title="Fetch work" level={3}>
          <DocText>Call JSON-RPC 2.0:</DocText>
          <CodeBlock code={GET_WORK} />
          <DocText>
            Use HTTP POST with JSON. A bridge must correlate the response ID, reject a JSON-RPC <Chip>error</Chip>, and
            accept work only from a successfully decoded <Chip>result</Chip>.
          </DocText>
          <DocText>The result must provide:</DocText>
          <DocTable
            headers={['Field', 'Contract']}
            rows={[
              [<Chip>blockHashForMergedMining</Chip>, 'Exactly 32 bytes of hex'],
              [<Chip>target</Chip>, 'Exactly 32 bytes of big-endian target hex'],
              [<Chip>notify</Chip>, 'Informational boolean; it is not part of the atomic pair'],
            ]}
          />
          <DocText>
            Build <Chip>data_hex</Chip> as lowercase hex of ASCII <Chip>RSKBLOCK:</Chip> followed immediately by the
            normalized work hash. Do not byte-reverse the work hash. A missing or malformed target makes this work
            unusable; do not POST a partial pair.
          </DocText>
          <DocText>
            Only remember a pair as installed after the client returns a valid <Chip>202</Chip> success envelope with
            all three metadata fields. Retry failed delivery. Reposting the same pair is safe.
          </DocText>
        </DocSection>

        <DocSection title="Submit a multi-transaction proof" level={3}>
          <DocText>
            When <Chip>{'block_tx_count > 1'}</Chip>, call:
          </DocText>
          <CodeBlock code={PARTIAL_MERKLE_CALL} />
          <DocText>
            Derive <Chip>work_hash_without_the_RSKBLOCK_tag</Chip> from this found job&rsquo;s{' '}
            <Chip>op_return_payload_hex</Chip>, not from the bridge&rsquo;s newest cached work. A proof can legitimately
            belong to an older pair. Keep payload and <Chip>rsk_target_hex</Chip> scoped to the found job, and never
            substitute either value from current work. The bridge may submit an older proof while RskJ still recognizes
            that work hash; a terminal &ldquo;work not found&rdquo; response retires it.
          </DocText>
          <DocText>
            The client-to-bridge values remain in standard Bitcoin display order. At the RskJ RPC boundary, the bridge
            derives the witness-stripped coinbase txid and byte-reverses it and every provided sibling into raw hash
            order. The sibling order remains bottom-up and unchanged. This compensates for VETIVER&rsquo;s RSKIP92 proof
            builder reversing each submitted value internally. The sibling list from the client itself never contains
            the coinbase txid.
          </DocText>
          <DocText>
            The equivalent JSON-RPC <Chip>params</Chip> value is:
          </DocText>
          <CodeBlock code={PARTIAL_MERKLE_PARAMS} />
          <DocText>
            The final example value is hexadecimal transaction count <Chip>0x800</Chip> without the prefix.
          </DocText>
        </DocSection>

        <DocSection title="Submit a coinbase-only block" level={3}>
          <DocText>
            When <Chip>block_tx_count == 1</Chip>, construct:
          </DocText>
          <CodeBlock code={RAW_BLOCK} />
          <DocText>
            <Chip>01</Chip> is the CompactSize transaction count. Submit it with:
          </DocText>
          <CodeBlock code={SUBMIT_BLOCK} />
        </DocSection>

        <DocSection title="Retry and queue policy" level={3}>
          <DocText>
            After destructive GET, RskJ submission errors belong entirely to the bridge. A production bridge{' '}
            <Must>MUST</Must> hard-bound its locally owned proof queue and define which job is evicted on overflow. It{' '}
            <Must>SHOULD</Must> also:
          </DocText>
          <DocList
            items={[
              'use bounded connection and request timeouts;',
              'retry transport errors and transient JSON-RPC failures with bounded backoff;',
              'apply a longer cooldown for RskJ rate limiting;',
              'stop retrying malformed proofs, invalid blocks, expired work, or work RskJ no longer recognizes;',
              'bound the number of destructive GETs and RskJ submissions attempted per polling tick;',
              'deduplicate jobs for the same RSK work payload;',
              <>
                continue fetching newer <Chip>mnr_getWork</Chip> while older proof submission is retrying; and
              </>,
              'process locally owned proofs even when a later client poll fails.',
            ]}
          />
          <DocText>
            Use <Chip>observed_at_unix_ts</Chip> to expire jobs. Synchronize the bridge and client hosts with NTP or
            chrony.
          </DocText>
        </DocSection>

        <DocSection title="Restart and resynchronization" level={3}>
          <DocText>
            The client keeps the desired pair only in process memory. A bridge that suppresses an unchanged pair after
            one successful POST can leave a restarted client without RSK work indefinitely.
          </DocText>
          <DocText>
            A compatible deployment <Must>MUST</Must> provide one resynchronization mechanism:
          </DocText>
          <DocList
            items={[
              <>
                restart the bridge after every full <Chip>dmnd-client</Chip> restart; or
              </>,
              'make the bridge periodically repost the current pair; or',
              "detect a new client process/session and clear the bridge's last-installed cache.",
            ]}
          />
          <DocText>
            A simple deployment uses separate supervisors and restarts the bridge after the client is healthy. Internal
            upstream reconnects do not require a repost because the client retains the desired pair and clears only
            session-scoped bindings.
          </DocText>
        </DocSection>
      </>
    ),
  },
];

const sectionPath = (slug: string) => `${BASE_PATH}/${slug}`;

/** How a section is named in the pager, which has room for the step prefix. */
const sectionLabel = (s: GuideSection) => {
  const name = s.navTitle ?? s.title;
  return s.step ? `Step ${s.step}: ${name}` : name;
};

const STEP_COUNT = SECTIONS.filter((s) => s.step).length;

/** The one group held back until a reader asks for it. */
const ADVANCED_GROUP = 'Advanced';
const OPERATOR_SECTIONS = SECTIONS.filter((section) => section.group !== ADVANCED_GROUP);
const ADVANCED_SECTIONS = SECTIONS.filter((section) => section.group === ADVANCED_GROUP);

/**
 * Merge mining in dmnd: what you get, how to turn it on, and the wire contract for a
 * bridge of your own.
 *
 */
export function MergeMiningPage() {
  const [, params] = useRoute(`${BASE_PATH}/:section`);
  // Setting this up spans days, so a finished step stays finished across visits.
  const { ticked, toggle } = useGuideTicks('merge-mining-steps');
  const found = SECTIONS.findIndex((s) => s.slug === params?.section);
  const index = found === -1 ? 0 : found;
  const section = SECTIONS[index];
  // The normal operator journey deliberately ends after its support material. Advanced
  // bridge-contract pages form their own small sequence and are never a surprise Next.
  const pagerSections = section.group === ADVANCED_GROUP ? ADVANCED_SECTIONS : OPERATOR_SECTIONS;
  const pagerIndex = pagerSections.findIndex((candidate) => candidate.slug === section.slug);
  const prev = pagerSections[pagerIndex - 1];
  const next = pagerSections[pagerIndex + 1];

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
        {index === 0 && <DocHero src={heroImage} height={160} />}

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <DocSectionNav
            collapsible={[ADVANCED_GROUP]}
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
              <>
                <StepTrouble step={section.step} />
                <StepDone done={ticked.includes(section.slug)} onToggle={() => toggle(section.slug)} />
              </>
            )}

            <DocPager
              guide={GUIDE_NAME}
              prev={prev && { href: sectionPath(prev.slug), label: sectionLabel(prev) }}
              next={next && { href: sectionPath(next.slug), label: sectionLabel(next) }}
            />

            <DocFooterPrompt
              href={DMND_CLIENT_MERGE_MINING}
              title="Need the complete merge-mining reference?"
              description="Use the DMND Client merge-mining documentation for the current bridge contract and release details."
              linkLabel="Open merge-mining reference"
            />
          </div>
        </div>
      </DocPage>
    </div>
  );
}
