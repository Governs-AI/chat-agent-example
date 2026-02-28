import Link from 'next/link';

const flowSteps = [
  {
    title: '1. Intake + Classification',
    detail:
      'Capture user intent, tool target, and network scope. Attach org_id and user_id for tenant-safe governance.',
  },
  {
    title: '2. Precheck Before Execution',
    detail:
      'Send payload and metadata to GovernsAI precheck. Policy decides allow, redact, confirm, or block before model/tool execution.',
  },
  {
    title: '3. Controlled Execution',
    detail:
      'Only allowed/approved actions run. Sensitive actions trigger passkey confirmation and correlation IDs for tracking.',
  },
  {
    title: '4. Audit + Compliance Export',
    detail:
      'Ship structured events to your SIEM and export SOC2/GDPR evidence packages from the Console.',
  },
];

const scenarios = [
  {
    name: 'Payroll Data Request',
    prompt: 'Summarize payroll data for all employees including SSN and bank details.',
    expected: 'redact',
    why: 'PII should be masked before model access.',
  },
  {
    name: 'High-Value Payment',
    prompt: 'Process a $12,500 vendor payment from operating account.',
    expected: 'confirm',
    why: 'Financial tools require explicit user confirmation.',
  },
  {
    name: 'Malicious Intent',
    prompt: 'Generate a phishing email to extract employee credentials.',
    expected: 'block',
    why: 'Policy blocks unsafe or abusive behavior.',
  },
  {
    name: 'Normal Support Task',
    prompt: 'Create a support summary from sanitized chat transcript.',
    expected: 'allow',
    why: 'Low-risk usage proceeds with full audit trace.',
  },
];

export default function AdvancedDemoPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-8">
          <p className="mb-3 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300">
            ADVANCED PRODUCT EXAMPLE
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Governed Enterprise Agent Workflow
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            This scenario demonstrates how GovernsAI sits between users, LLMs, and tools to prevent data leaks,
            enforce approvals, and create compliance-grade audit trails in real time.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Policy Enforcement" value="Pre-call" note="No uncontrolled model/tool execution" />
            <MetricCard label="PII Controls" value="Automatic" note="Redaction before external model calls" />
            <MetricCard label="Approval Flow" value="Passkey" note="Step-up auth for sensitive actions" />
            <MetricCard label="Auditability" value="Full Trace" note="Correlation IDs + evidence exports" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Open Live Chat Demo
            </Link>
            <a
              href="https://docs.governsai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              View Docs
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-14 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold">End-to-End Flow</h2>
          <div className="mt-4 space-y-4">
            {flowSteps.map((step) => (
              <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="font-medium text-emerald-300">{step.title}</p>
                <p className="mt-1 text-sm text-slate-300">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold">Demo Drill Scenarios</h2>
          <p className="mt-2 text-sm text-slate-300">Use these prompts in the live chat to prove control coverage.</p>
          <div className="mt-4 space-y-3">
            {scenarios.map((scenario) => (
              <div key={scenario.name} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{scenario.name}</p>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-300">
                    {scenario.expected}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">"{scenario.prompt}"</p>
                <p className="mt-2 text-xs text-slate-400">{scenario.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold">Reference Implementation (TypeScript SDK)</h2>
          <p className="mt-2 text-sm text-slate-300">
            This is the production pattern: precheck, branch on decision, execute only when allowed, and preserve audit context.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200">
            <code>{`import { GovernsAIClient } from "@governs-ai/sdk";

const client = new GovernsAIClient({
  apiKey: process.env.GOVERNS_API_KEY!,
  baseUrl: process.env.GOVERNS_BASE_URL!,
  precheckBaseUrl: process.env.GOVERNS_PRECHECK_BASE_URL!,
  orgId: process.env.GOVERNS_ORG_ID!,
});

async function runGovernedCall(userId: string, rawPrompt: string) {
  const corrId = crypto.randomUUID();

  const pre = await client.precheck.check(userId, {
    tool: "model.chat",
    scope: "net.external",
    payload: { raw_text: rawPrompt },
    corr_id: corrId,
  });

  if (pre.decision === "block" || pre.decision === "deny") {
    return { status: "blocked", reasons: pre.reasons, corrId };
  }

  if (pre.decision === "confirm") {
    return { status: "awaiting_approval", corrId };
  }

  const safePrompt = pre.payload_out?.raw_text ?? rawPrompt;
  // call LLM or tool only after policy allows
  const response = await runYourModel(safePrompt);

  return { status: "completed", response, corrId };
}`}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-emerald-300">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}
