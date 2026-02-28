'use client';

import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'] });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const trustSignals = [
  { label: 'Policy Enforcement', value: 'Pre-call required' },
  { label: 'PII Redaction', value: 'Automatic' },
  { label: 'High-Risk Actions', value: 'Passkey approval' },
  { label: 'Audit Trail', value: 'Correlation IDs' },
];

const flowSteps = [
  { title: 'Classify', detail: 'Every request is tagged with tool, scope, and user context.' },
  { title: 'Decide', detail: 'GovernsAI policy returns allow, redact, confirm, or block.' },
  { title: 'Execute', detail: 'Only approved actions proceed to model or tool execution.' },
];

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLogin = async () => {
    setIsSigningIn(true);
    await signIn("governsai", { callbackUrl });
  };

  return (
    <div className={`${jakarta.className} relative min-h-screen overflow-hidden bg-[#07131f]`}>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-[-8rem] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-700/50 bg-slate-900/65 p-7 backdrop-blur-md sm:p-9">
            <p className="mb-4 inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
              GovernsAI Command Access
            </p>
            <h1 className={`${spaceGrotesk.className} text-3xl font-bold tracking-tight text-white sm:text-4xl`}>
              Govern AI operations from the first prompt to every tool call
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              This example chat is wired to GovernsAI policy controls. Login gives you an auditable,
              policy-enforced workflow where risky actions are intercepted before execution.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {trustSignals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{signal.label}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-100">{signal.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-white">What happens after sign in</p>
              <div className="mt-3 space-y-3">
                {flowSteps.map((step, index) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 text-xs font-semibold text-slate-200">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{step.title}</p>
                      <p className="text-xs leading-5 text-slate-400">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700/60 bg-white/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Secure Sign In</p>
              <h2 className={`${spaceGrotesk.className} mt-2 text-3xl font-bold text-slate-900`}>Welcome back</h2>
              <p className="mt-2 text-sm text-slate-600">
                Authenticate with GovernsAI Identity to enter your governed chat workspace.
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">This session includes</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  Organization-aware access boundaries
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  Real-time policy decisions with rationale
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  Confirm/block gates for sensitive tool operations
                </li>
              </ul>
            </div>

            <button
              onClick={handleLogin}
              disabled={isSigningIn}
              className="group relative w-full overflow-hidden rounded-xl bg-[#0f2540] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#143257] disabled:cursor-not-allowed disabled:opacity-75"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent transition duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                {isSigningIn ? 'Redirecting to GovernsAI...' : 'Continue with GovernsAI'}
              </span>
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              By continuing, you agree to GovernsAI terms and privacy policy.
              Your access follows your organization role and governance policy.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Identity and policy services operational
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#07131f]">
        <div className="text-slate-300">Loading sign-in experience...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
