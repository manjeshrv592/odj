/**
 * Money primitives and the platform-fee split (§5 Payments).
 *
 * **All money is integer paise.** Rupee floats are never used for arithmetic —
 * binary floating point cannot represent `0.1` exactly, and silently losing a
 * fraction of a paisa on real money is not acceptable. Razorpay's APIs take
 * paise too, so paise-in/paise-out avoids a conversion layer entirely.
 *
 * Worker rates (`worker_profession_rates`) are stored as **whole rupees**, so
 * a job's amount always lands on a whole-rupee boundary; the paise granularity
 * exists for the fee/tax split, not for the rate itself.
 */
import { z } from "zod";

export const PAISE_PER_RUPEE = 100;

/** Basis points: 10000 bps = 100%. Fees/taxes are configured in bps so a rate
 *  like 0.1% (TDS 194-O) is expressible as an integer (10) with no rounding. */
export const BPS_DENOMINATOR = 10_000;

/** Whole rupees → paise. Rejects non-integers so a stray float can't slip in. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isInteger(rupees)) {
    throw new Error(`rupeesToPaise expects whole rupees, got ${rupees}`);
  }
  return rupees * PAISE_PER_RUPEE;
}

/**
 * Paise → a display string like `₹1,250` (or `₹1,250.50` when there is a paisa
 * remainder, which only happens on fee/tax lines, never on a job total).
 */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;
  // en-IN grouping (1,00,000) is what Indian users expect, not 100,000.
  const grouped = rupees.toLocaleString("en-IN");
  return remainder === 0
    ? `${sign}₹${grouped}`
    : `${sign}₹${grouped}.${String(remainder).padStart(2, "0")}`;
}

/** How much of a job's amount the platform keeps, and what taxes are withheld. */
export const feeConfigSchema = z.object({
  /** Platform commission, deducted from the worker's share. 1500 = 15%. */
  platformFeeBps: z.number().int().min(0).max(BPS_DENOMINATOR),
  /**
   * TDS u/s 194-O. Currently 0.1% (10 bps) and only once a participant crosses
   * ₹5L gross in a financial year — defaults to 0 until a CA confirms ODJ's
   * obligation, rather than hard-coding a guess about tax law.
   */
  tdsBps: z.number().int().min(0).max(BPS_DENOMINATOR),
  /** GST TCS u/s 52. Currently 0.5% (50 bps). Defaults to 0 — see `tdsBps`. */
  tcsBps: z.number().int().min(0).max(BPS_DENOMINATOR),
});
export type FeeConfig = z.infer<typeof feeConfigSchema>;

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  platformFeeBps: 1500,
  tdsBps: 0,
  tcsBps: 0,
};

/** The four lines of a job's receipt. Always sums back to `grossPaise` exactly. */
export const jobSplitSchema = z.object({
  grossPaise: z.number().int().min(0),
  platformFeePaise: z.number().int().min(0),
  tdsPaise: z.number().int().min(0),
  tcsPaise: z.number().int().min(0),
  /** What actually leaves the RazorpayX balance to the worker. */
  netPaise: z.number().int().min(0),
});
export type JobSplit = z.infer<typeof jobSplitSchema>;

/**
 * Split a job's gross amount into platform fee, withheld taxes and the worker's
 * net payout.
 *
 * Each deduction is **floored** and `net` is the remainder, so the four lines
 * always add back up to `gross` with no orphaned paise, and a rounding error can
 * only ever favour the worker (we never over-deduct). Deterministic and
 * integer-only, so backend, web and mobile always agree on the receipt.
 */
export function splitJobAmount(grossPaise: number, fees: FeeConfig): JobSplit {
  if (!Number.isInteger(grossPaise) || grossPaise < 0) {
    throw new Error(`splitJobAmount expects non-negative integer paise, got ${grossPaise}`);
  }
  const platformFeePaise = Math.floor((grossPaise * fees.platformFeeBps) / BPS_DENOMINATOR);
  const tdsPaise = Math.floor((grossPaise * fees.tdsBps) / BPS_DENOMINATOR);
  const tcsPaise = Math.floor((grossPaise * fees.tcsBps) / BPS_DENOMINATOR);
  const netPaise = grossPaise - platformFeePaise - tdsPaise - tcsPaise;
  if (netPaise < 0) {
    throw new Error("Fee configuration deducts more than the job amount");
  }
  return { grossPaise, platformFeePaise, tdsPaise, tcsPaise, netPaise };
}
