/**
 * Keyword safety check. Runs on the raw note before any provider, plugin or strategy sees it,
 * and nothing in the plugin system can turn it off. Small local models are unreliable at
 * spotting crisis language, so this list is the primary safety net, not the model's risk_flag.
 *
 * It is deliberately over-inclusive: a false alarm shows a support card, a miss could matter a lot.
 * English only and not exhaustive.
 */

const RISK_PATTERNS: readonly RegExp[] = [
  /\bkill(ing)? my ?self\b/,
  /\bend(ing)? it all\b/,
  /\bend(ing)? my (own )?life\b/,
  /\btak(e|ing) my (own )?life\b/,
  /\b(want|wanna|wanted|going|ready) (to )?die\b/,
  /\bwish i (was|were) dead\b/,
  /\bbetter off dead\b/,
  /\bno (point|reason) (in |to )?(living|live|go(ing)? on)\b/,
  /\b(hurt|harm|cut)(ing)? my ?self\b/,
  /\bself ?harm/,
  /\bsuicid/,
  /\bcan ?not go on\b/,
  /\bcant go on\b/,
  /\bcould not go on\b/,
  /\bcouldnt go on\b/,
  /\b(dont|do not) want to (be alive|live|exist|wake up)\b/,
  /\b(dont|do not) want to be here any ?more\b/,
  /\bnot worth living\b/,
  /\bdisappear forever\b/,
];

/** Lowercase, drop apostrophes ("can't" -> "cant"), turn punctuation into spaces, squash whitespace. */
export function normalizeForSafety(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface SafetyResult {
  risk: boolean;
  matched: string | null;
}

export function checkSafety(rawText: string): SafetyResult {
  const normalized = normalizeForSafety(rawText);
  for (const pattern of RISK_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return { risk: true, matched: match[0] };
  }
  return { risk: false, matched: null };
}

export const SUPPORT_MESSAGE = {
  heading: "It sounds like you're carrying something really heavy right now.",
  body: "Thank you for writing it down. Sproutpatch can't help with this alone, and you deserve real support from a person.",
  helpline:
    "In India, you can call Tele-MANAS at 14416. If you're elsewhere, please contact your local emergency or crisis line. If you're in immediate danger, call your local emergency number.",
  reachOut: "If you can, reach out to someone you trust today: a friend, family member, or anyone you feel safe with. You don't have to go through this by yourself.",
} as const;
