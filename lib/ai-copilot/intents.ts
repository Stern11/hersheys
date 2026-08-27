import type { CopilotIntent, MutationCommand } from "./types";

/**
 * Intent recognition for the Heizen copilot.
 *
 * This is deliberately a *legible surface of what the build supports*, not a
 * pretence of general language understanding. Two rules govern it:
 *
 *  1. It recognizes QUESTIONS, not just commands. The previous parser could
 *     only execute mutations, so "why is Line 03 red" — the phrasing the
 *     placeholder itself advertises — fell through to a canned apology on
 *     every route.
 *  2. It never guesses. Anything it cannot place returns `unrecognized`, and
 *     the answer layer responds with the real capability list computed from
 *     live scenario state rather than a generic "I didn't understand".
 *
 * Order matters and is asserted in the tests: explanations are matched before
 * mutations (so "what changed" is never read as a command), mutations before
 * navigation (so "set the run rate on the gaps page" is not a page change),
 * and navigation before the greeting/fallback.
 */

const WORD_NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** Parses "8,200" / "8200" / "6000." into a number. Returns null for anything else. */
export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, "").replace(/\.$/, ""));
  return Number.isFinite(n) ? n : null;
}

function wordOrDigit(raw: string | undefined): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  return WORD_NUMBER[raw] ?? null;
}

export function parseIntent(input: string): CopilotIntent {
  const lower = input.trim().toLowerCase();
  if (!lower) return { kind: "unrecognized" };

  /* --- 1. explanations ------------------------------------------------ */
  const explanation = parseExplanation(lower);
  if (explanation) return explanation;

  /* --- 2. mutations --------------------------------------------------- */
  const command = parseMutation(lower);
  if (command) return { kind: "mutate", command };

  /* --- 3. navigation -------------------------------------------------- */
  const nav = parseNavigation(lower);
  if (nav) return nav;

  /* --- 4. greeting / fallback ----------------------------------------- */
  if (/^(hi|hello|hey|yo|hiya|sup|good (morning|afternoon|evening))\b/.test(lower)) return { kind: "greeting" };
  if (/^(what can you do|help|capabilities|what do you support)\b/.test(lower)) return { kind: "greeting" };
  return { kind: "unrecognized" };
}

/** Words that mean "a production line is the subject of this sentence". */
const LINE_MENTION = /\bline[ _-]?0?\d\b|\bl0\d\b|\bstuarts?\b|\bhershey\b|\breese\b|\bwest hershey\b/;
const RISK_WORD = /\bred\b|\bamber\b|\bgreen\b|\bat risk\b|\brisk(y|ed)?\b|\bcritical\b|\bwarning\b|\bhot\b|\btight\b|\bbottleneck\b|\bover ?(loaded|capacity|committed)\b|\bconstrain/;

function parseExplanation(lower: string): CopilotIntent | null {
  // "what changed" — before everything, so it is never read as a command.
  if (/\bwhat(?:'s|s| has| have i| did i| did we)? chang/.test(lower) || /\bwhat'?s different\b/.test(lower) || /\b(?:show|list)( me)? (?:the )?(?:changes|diffs?|overrides)\b/.test(lower) || /\bdiff\b.*\bbaseline\b/.test(lower)) {
    return { kind: "what_changed" };
  }

  if (/\bevidence\b|\bsignals?\b|\bwhere did (?:this|that|the) (?:number|data) come from\b/.test(lower)) {
    return { kind: "explain_evidence" };
  }

  if (/\bdeadline\b|\border[- ]?by\b|\bwhen (?:do|must|should) (?:i|we) (?:need to |have to |)(?:decide|order|commit)\b|\bhow long (?:do|have) (?:i|we)\b/.test(lower)) {
    return { kind: "explain_deadline" };
  }

  if (/\bwhat should i do\b|\bwhat do i do\b|\bwhat (?:are|were) my options\b|\bwhat can i do\b|\brecommend|\bsuggest|\bhow (?:do|can|should) (?:i|we) fix\b|\bnext steps?\b|\bwhat now\b|\bmy levers?\b|\bwhat levers?\b/.test(lower)) {
    return { kind: "recommend" };
  }

  if (/\bwhat basis\b|\bwhich basis\b|\bwhy this basis\b|\bwhat'?s the basis\b|\bmethodolog/.test(lower) || (/\bhow (?:did|do) (?:you|we|heizen)\b/.test(lower) && /\b(get|compute|calculate|derive|work(ed)? (that|this) out)\b/.test(lower))) {
    return { kind: "explain_basis" };
  }

  // "why is line 03 red" / "explain Stuarts Draft L03" / "why is it red"
  const asksWhy = /\bwhy\b|\bexplain\b|\bwhat'?s (?:going on|wrong|happening)\b|\bstatus of\b/.test(lower);
  if (LINE_MENTION.test(lower) && (asksWhy || RISK_WORD.test(lower)) && !/\bset\b|\bchange\b|\braise\b|\blower\b|\bmake it\b/.test(lower)) {
    return { kind: "explain_line", lineQuery: lower };
  }
  // No line named, but the question is clearly about the risk colour.
  if (asksWhy && RISK_WORD.test(lower)) {
    return { kind: "explain_line", lineQuery: lower };
  }

  return null;
}

/** Removes "line 03" / "l03" / "line_03" so a line NUMBER can never be parsed as a value. */
function withoutLineToken(lower: string): string {
  return lower.replace(/\bline[ _-]?0?\d+\b/g, " ").replace(/\bl0\d\b/g, " ");
}

function parseMutation(lower: string): MutationCommand | null {
  /* --- historical basis ------------------------------------------------ */
  const seasons = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:comparable\s+)?(?:seasons?|years?)/.exec(lower);
  if (seasons) {
    const n = wordOrDigit(seasons[1]);
    if (n != null) return { op: "setLookback", seasons: n };
  }
  const excluded = /\b(?:exclude|drop|leave out|remove|ignore)\s+(?:the\s+)?(20\d\d)/.exec(lower);
  if (excluded?.[1]) return { op: "excludeSeason", year: excluded[1] };
  const included = /\b(?:include|add back|put back|bring back|add)\s+(?:the\s+)?(20\d\d)/.exec(lower);
  if (included?.[1]) return { op: "includeSeason", year: included[1] };

  /* --- lead time -------------------------------------------------------- */
  if (/lead ?time/.test(lower)) {
    if (/\bp-?80\b|\b80th\b/.test(lower)) return { op: "setLeadTimeBasis", materialQuery: lower, basis: "historical", statistic: "p80" };
    if (/\bmedian\b|\bp-?50\b/.test(lower)) return { op: "setLeadTimeBasis", materialQuery: lower, basis: "historical", statistic: "median" };
    if (/\bsystem\b|\berp\b|\bstandard\b/.test(lower)) return { op: "setLeadTimeBasis", materialQuery: lower, basis: "system" };
    const days = parseNumber(/(\d{1,3})\s*(?:d\b|days?\b)/.exec(lower)?.[1]);
    if (days != null) return { op: "setLeadTimeDays", materialQuery: lower, days };
  }

  /* --- run rate --------------------------------------------------------- */
  if (/run[ _-]?rate|units? (?:an|per) hour|\/ ?hr\b/.test(lower)) {
    // Strip the line token first, so "line 03" can never be read as the rate.
    const rate = parseNumber(/(\d[\d,]*)/.exec(withoutLineToken(lower))?.[1]);
    if (rate != null) return { op: "setRunRate", lineQuery: lower, unitsPerHour: rate };
  }

  /* --- utilization alert threshold -------------------------------------- */
  if (/threshold|alert|target utilization|utili[sz]ation target|\bflag\b/.test(lower)) {
    const pct = parseNumber(/(-?\d{1,3})\s*%/.exec(lower)?.[1]);
    if (pct != null) return { op: "setTargetUtilization", lineQuery: lower, pct: pct / 100 };
  }

  /* --- growth ----------------------------------------------------------- */
  if (/growth/.test(lower)) {
    const pct = parseNumber(/(-?\d{1,3}(?:\.\d+)?)\s*%/.exec(lower)?.[1]);
    if (pct != null) return { op: "setGrowth", pct: pct / 100 };
  }

  /* --- analogue weighting ------------------------------------------------ */
  if (/analogue|analog\b|reweight|weight/.test(lower)) {
    const pct = parseNumber(/(\d{1,3})\s*%/.exec(lower)?.[1]);
    if (pct != null) return { op: "setAnalogueWeight", analogueQuery: lower, weight: pct / 100 };
  }

  /* --- lifecycle --------------------------------------------------------- */
  if (/\breset\b|\brevert\b|\bstart over\b|\bback to baseline\b/.test(lower)) return { op: "reset" };
  if (/\bsave\b|\bkeep (?:this|it)\b/.test(lower)) return { op: "save" };

  return null;
}

const NAV_VERB = /\b(open|go to|goto|navigate to|take me to|show me|jump to|switch to)\b/;

function parseNavigation(lower: string): CopilotIntent | null {
  const bare = lower.replace(/[?.!]+$/, "").trim();
  const targets: Array<{ target: "overview" | "gaps" | "decisions" | "scenario-lab"; re: RegExp; exact: RegExp }> = [
    { target: "scenario-lab", re: /\bscenario lab\b/, exact: /^(the )?scenario lab$/ },
    { target: "decisions", re: /\bdecisions?\b/, exact: /^(the )?decisions?( page| queue)?$/ },
    { target: "gaps", re: /\b(planning )?gaps?\b/, exact: /^(the )?(planning )?gaps?( list| page| inventory)?$/ },
    { target: "overview", re: /\boverview\b|\bdashboard\b|\bhome\b/, exact: /^(the )?(overview|dashboard|home)$/ },
  ];

  for (const t of targets) {
    if (t.exact.test(bare)) return { kind: "navigate", target: t.target };
    if (NAV_VERB.test(lower) && t.re.test(lower)) return { kind: "navigate", target: t.target };
  }
  return null;
}

export const NAV_PATHS: Record<"overview" | "gaps" | "decisions" | "scenario-lab", string> = {
  overview: "/overview",
  gaps: "/gaps",
  decisions: "/decisions",
  "scenario-lab": "/scenario-lab",
};
