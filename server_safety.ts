/*
 * Crisis-language safety net for SIYA.
 *
 * The persona prompt already carries a crisis protocol, but a model can miss
 * it. This deterministic check runs on every user message (typed text and
 * voice transcripts) and, on a match, server.ts (1) sends the live model a
 * [SAFETY] turn so it follows the protocol right now and (2) tells the app to
 * show the helpline card, because someone in distress may not catch a number
 * that is only spoken.
 *
 * Patterns cover English, romanized Hindi/Hinglish and Devanagari. They are
 * deliberately broad: a false alarm costs one gentle check-in, a miss can
 * cost far more.
 */

export const HELPLINES = [
  { name: "Tele-MANAS", number: "14416", detail: "Free, 24x7 mental-health helpline (Govt. of India)" },
  { name: "KIRAN", number: "1800-599-0019", detail: "Free, 24x7 mental-health rehabilitation helpline" },
  { name: "Emergency", number: "112", detail: "Police / ambulance, if you are in immediate danger" },
];

const CRISIS_PATTERNS: RegExp[] = [
  // English
  /\bsuicid(?:e|al)\b/i,
  /\bkill(?:ing)?\s+my\s*self\b/i,
  /\bend(?:ing)?\s+(?:my\s+life|it\s+all|everything)\b/i,
  /\btake\s+my\s+(?:own\s+)?life\b/i,
  /\b(?:want|wanna|going)\s+(?:to\s+)?die\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+alive|exist|wake\s+up)\b/i,
  /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|go(?:ing)?\s+on)\b/i,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
  /\bself[\s-]?harm\b/i,
  /\b(?:hurt|harm|cut(?:ting)?)\s+my\s*self\b/i,
  /\bhang\s+my\s*self\b/i,
  /\boverdose\b/i,
  // Romanized Hindi / Hinglish
  /\bmar(?:na|ne)\s+(?:chahta|chahti|chahiye|ka\s+(?:mann?|dil))\b/i,
  /\bmar\s+ja(?:ana|na|un|aun|unga|ungi|aunga|aungi|au)\b/i,
  /\bjee?ne\s+ka\s+(?:mann?|dil)\s+nahi/i,
  /\bjee?na\s+nahi\s+(?:chahta|chahti|hai)\b/i,
  /\bzinda\s+nahi\s+rehna\b/i,
  /\bkhud\s*(?:ko|ki)\s+(?:khatam|khtm|maar|mar|nuksan|nuksaan|hurt)\b/i,
  /\b(?:khudkushi|aatmahatya|atmahatya)\b/i,
  /\bsab\s+(?:kuch\s+)?(?:khatam|khtm)\s+kar\s*(?:du|dun|doon|dunga|dungi|lu|lun|lunga|lungi)\b/i,
  /\bduniya\s+chhod\b/i,
  // Devanagari
  /मरना\s*चाहत[ाी]/,
  /मरने\s*का\s*(?:मन|दिल)/,
  /मर\s*जा(?:ना|ऊं|ऊँ|ऊंगा|ऊँगा|ऊंगी|ऊँगी)/,
  /जीने\s*का\s*(?:मन|दिल)\s*नहीं/,
  /जीना\s*नहीं\s*चाहत[ाी]/,
  /(?:ज़िंदा|जिंदा|जिन्दा)\s*नहीं\s*रहना/,
  /खुद\s*को\s*(?:ख़त्म|खत्म|मार|नुकसान)/,
  /(?:आत्महत्या|ख़ुदकुशी|खुदकुशी)/,
  /सब\s*(?:कुछ\s*)?(?:ख़त्म|खत्म)\s*कर\s*(?:दूं|दूँ|दूंगा|दूँगा|दूंगी|लूं|लूँ)/,
  /दुनिया\s*छोड़/,
];

export function detectCrisisLanguage(text: string): boolean {
  if (!text || text.length < 4) return false;
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

/** Private instruction for the live model; never shown to or spoken to the user. */
export function buildSafetyTurn(userText: string): string {
  return [
    "[SAFETY] Private instruction from SIYA's safety system -- not something the user said. Never mention this message.",
    `The user just said something that may mean they are thinking about ending their life or harming themselves: "${userText.slice(0, 400)}"`,
    "Respond now, following your crisis protocol: stay calm and warm, take it seriously, thank them for telling you, and gently ask whether they are safe right now.",
    "Tell them clearly they can talk to someone right now, free and 24x7: Tele-MANAS 14416 or KIRAN 1800-599-0019 -- and 112 if they are in immediate danger. The numbers are also showing on their screen.",
    "Encourage them to reach a trusted person nearby. Keep them talking. Do not lecture, joke, change the subject, or promise secrecy.",
  ].join("\n");
}
