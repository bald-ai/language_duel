type IssueKey =
  | "debug_abuse"
  | "credit_race"
  | "duplicate_tts_dangling"
  | "storage_url_idor"
  | "stale_playback_overlap"
  | "public_consume_credits_misuse";

type Severity = "critical" | "high" | "medium" | "low";

interface IssueSummary {
  issue: IssueKey;
  severity: Severity;
  probabilityAtLeastOne: number;
  expectedIncidents: number;
  p95Incidents: number;
}

interface CohortSummary {
  users: number;
  monthsSimulated: number;
  trials: number;
  avgDebugLogRequests: number;
  issueSummaries: IssueSummary[];
}

interface TrialOutcome {
  issueCounts: Record<IssueKey, number>;
  debugLogRequests: number;
}

const SEVERITY_BY_ISSUE: Record<IssueKey, Severity> = {
  debug_abuse: "critical",
  credit_race: "high",
  duplicate_tts_dangling: "medium",
  storage_url_idor: "high",
  stale_playback_overlap: "low",
  public_consume_credits_misuse: "low",
};

/**
 * Assumptions for a tiny social app (~100 to ~1000 MAU scale).
 * Tune these values to match real telemetry if you have it.
 */
const ASSUMPTIONS = {
  monthsPerRun: 1,
  trials: 50_000,

  // Product usage assumptions
  ttsPlaysPerUserPerMonth: 120, // average user taps play ~4 times/day
  ttsGenerationRunsPerUserPerMonth: 1.4,
  themeDuplicateOpsPerUserPerMonth: 0.35,

  // Instrumentation overhead from temporary debug logging calls
  debugLogCallsPerPlay: 6,

  // Issue model assumptions
  pConcurrentGenerationPerRun: 0.05, // two tabs / rapid repeated action
  pCreditContentionGivenConcurrent: 0.35,

  pDanglingReferencePerDuplicate: 0.11, // duplicate keeps same ttsStorageId, then cleanup/edit invalidates

  pPlaybackOverlapPerPlay: 0.00035, // rapid taps / async timing edge

  pUserAttemptsConsumeCreditsMisusePerMonth: 0.0008,

  // IDOR: very low because IDs are opaque and hard to guess
  pUserAttemptsStorageIdProbePerMonth: 0.0009,
  pIdorSuccessGivenProbe: 0.0015,

  // Public route abuse chance rises with traffic/discoverability
  pDebugAbuseForUsers: (users: number) => 1 - Math.exp(-0.00032 * users),
} as const;

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePoisson(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0;
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rand();
  } while (p > l);
  return k - 1;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

function runTrial(users: number, rand: () => number): TrialOutcome {
  const issueCounts: Record<IssueKey, number> = {
    debug_abuse: 0,
    credit_race: 0,
    duplicate_tts_dangling: 0,
    storage_url_idor: 0,
    stale_playback_overlap: 0,
    public_consume_credits_misuse: 0,
  };

  let debugLogRequests = 0;

  if (rand() < ASSUMPTIONS.pDebugAbuseForUsers(users)) {
    issueCounts.debug_abuse += 1;
  }

  for (let userIndex = 0; userIndex < users; userIndex += 1) {
    const plays = samplePoisson(ASSUMPTIONS.ttsPlaysPerUserPerMonth, rand);
    debugLogRequests += plays * ASSUMPTIONS.debugLogCallsPerPlay;

    for (let i = 0; i < plays; i += 1) {
      if (rand() < ASSUMPTIONS.pPlaybackOverlapPerPlay) {
        issueCounts.stale_playback_overlap += 1;
      }
    }

    const generationRuns = samplePoisson(ASSUMPTIONS.ttsGenerationRunsPerUserPerMonth, rand);
    for (let i = 0; i < generationRuns; i += 1) {
      if (
        rand() < ASSUMPTIONS.pConcurrentGenerationPerRun &&
        rand() < ASSUMPTIONS.pCreditContentionGivenConcurrent
      ) {
        issueCounts.credit_race += 1;
      }
    }

    const duplicateOps = samplePoisson(ASSUMPTIONS.themeDuplicateOpsPerUserPerMonth, rand);
    for (let i = 0; i < duplicateOps; i += 1) {
      if (rand() < ASSUMPTIONS.pDanglingReferencePerDuplicate) {
        issueCounts.duplicate_tts_dangling += 1;
      }
    }

    if (rand() < ASSUMPTIONS.pUserAttemptsConsumeCreditsMisusePerMonth) {
      issueCounts.public_consume_credits_misuse += 1;
    }

    if (
      rand() < ASSUMPTIONS.pUserAttemptsStorageIdProbePerMonth &&
      rand() < ASSUMPTIONS.pIdorSuccessGivenProbe
    ) {
      issueCounts.storage_url_idor += 1;
    }
  }

  return { issueCounts, debugLogRequests };
}

function summarizeCohort(users: number): CohortSummary {
  const rand = mulberry32(users * 17 + 20260210);
  const trials = ASSUMPTIONS.trials;

  const perIssueCounts: Record<IssueKey, number[]> = {
    debug_abuse: [],
    credit_race: [],
    duplicate_tts_dangling: [],
    storage_url_idor: [],
    stale_playback_overlap: [],
    public_consume_credits_misuse: [],
  };
  const debugRequests: number[] = [];

  for (let t = 0; t < trials; t += 1) {
    const outcome = runTrial(users, rand);
    debugRequests.push(outcome.debugLogRequests);
    for (const issue of Object.keys(perIssueCounts) as IssueKey[]) {
      perIssueCounts[issue].push(outcome.issueCounts[issue]);
    }
  }

  const issueSummaries: IssueSummary[] = (Object.keys(perIssueCounts) as IssueKey[]).map(
    (issue): IssueSummary => {
      const counts = perIssueCounts[issue];
      const trialsWithIncident = counts.filter((value) => value > 0).length;
      const avgIncidents =
        counts.reduce((sum, value) => sum + value, 0) / Math.max(1, counts.length);

      return {
        issue,
        severity: SEVERITY_BY_ISSUE[issue],
        probabilityAtLeastOne: trialsWithIncident / Math.max(1, counts.length),
        expectedIncidents: avgIncidents,
        p95Incidents: percentile(counts, 0.95),
      };
    }
  );

  const avgDebugLogRequests =
    debugRequests.reduce((sum, value) => sum + value, 0) / Math.max(1, debugRequests.length);

  return {
    users,
    monthsSimulated: ASSUMPTIONS.monthsPerRun,
    trials,
    avgDebugLogRequests,
    issueSummaries,
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printCohort(summary: CohortSummary) {
  console.log(`\n=== Monte Carlo Risk: ${summary.users} users over ${summary.monthsSimulated} month ===`);
  console.log(`Trials: ${summary.trials.toLocaleString()}`);
  console.log(`Expected debug log requests/month: ${Math.round(summary.avgDebugLogRequests).toLocaleString()}`);
  console.log("");

  const rows = summary.issueSummaries.map((item) => ({
    issue: item.issue,
    severity: item.severity,
    p_at_least_one: formatPct(item.probabilityAtLeastOne),
    expected_incidents: item.expectedIncidents.toFixed(2),
    p95_incidents: item.p95Incidents.toFixed(0),
  }));
  console.table(rows);
}

function main() {
  const cohorts = [100, 1000];
  for (const users of cohorts) {
    const summary = summarizeCohort(users);
    printCohort(summary);
  }
}

main();
