import { handbookSandboxCases } from './handbookData.ts';

export type SandboxCase = typeof handbookSandboxCases[number];
export type SandboxDecision = 'wait' | 'scale' | 'stop';
export type SandboxSlice = { spend: number; records: number; payable: number; accrual: number; contribution: number; cash: number };

const round = (value: number) => Math.round(value * 100) / 100;

// Replays change the sample, while the early and mature cut always describe the same run.
export function sandboxRun(source: SandboxCase, budgetScale: number, variant: number, decision: SandboxDecision = 'wait') {
  const volumeFactor = budgetScale * (1 + ([0, -0.1, 0.12, -0.06, 0.06][Math.abs(variant) % 5] ?? 0));
  const records = Math.max(1, Math.round(source.initial * volumeFactor));
  const spend = round(source.spend * budgetScale);
  const slice = (count: number, sourceCash: number): SandboxSlice => {
    const payable = Math.min(records, Math.max(0, Math.round(count * volumeFactor)));
    const accrual = round(payable * source.payout);
    return { spend, records, payable, accrual, contribution: round(accrual - spend), cash: round((sourceCash + source.spend) * budgetScale - spend) };
  };
  const early = slice(source.earlyAccepted, source.earlyCash);
  const mature = slice(source.matureAccepted, source.matureCash);
  const scaleSpend = decision === 'scale' ? round(spend * 0.3) : 0;
  return { early, mature, scaleSpend, totalCash: round(mature.cash - scaleSpend) };
}
