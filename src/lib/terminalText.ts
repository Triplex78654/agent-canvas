/** Reading what a CLI printed in its terminal: ANSI stripping, dialog/working detection, reply cleanup. Pure (tested). */

export function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)?/g, '') // OSC (window title…) — was leaking "]0;C:\WINDOWS…"
    // Cursor-forward (CSI n C) and erase-characters (CSI n X) stand for blanks: Codex and Windows ConPTY
    // draw spaces this way, and dropping them glued words together ("Jepropose«Mijotopia»").
    .replace(/\x1B\[(\d*)[CX]/g, (_m, n: string) => ' '.repeat(Math.min(200, Number(n) || 1)))
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '') // CSI (colors, other cursor moves)
    .replace(/\x1B[@-Z\\-_]/g, '') // other 2-char escapes
    .replace(/(^|\s)\]\d;[^\s\x07]*\x07?/g, '$1'); // OSC split across chunks (ESC in previous chunk)
}

/** A question on screen the CLI is waiting for (folder trust, login…): never type a mission into it. */
export const BLOCKING_DIALOG_RE =
  /do you trust|trust (this|the) (folder|files|project|workspace|directory)|yes, i trust|enter to confirm|press enter to continue|select (a )?login method|sign in with|log ?in to (continue|your)|login required|choose (the|a) (text )?(style|theme)|how would you like to authenticate|would you like to (run the following|make the following edits|make these changes)|do you want to (proceed|make this edit|create)/i;
/** The CLI is still producing its answer. */
export const WORKING_RE = /esc to (interrupt|cancel)|thinking\.\.\.|thinking…|working\.\.\.|working…/i;
/** Interface chrome that is not part of an answer (input box, hints, footers). */
export const CHROME_LINE_RE =
  /\? for shortcuts|esc to (interrupt|cancel|dismiss)|ctrl\+|shift\+tab|auto-accept|auto mode|bypass permissions|context left|tokens? (used|left)|for (help|commands)|type your message|^\s*[✻✳✢✶✽]\s|\b\w+(ed|t) for \d+(\.\d+)?\s*(s|m|ms)\b|\bdone \d{1,2}:\d{2}|\d+ tokens\b|update installed|restart to update|\/effort\b|\/model\b|ask codex to do anything|·\s*~\s*(·|$)|no sandbox|^\s*using:?\s+\d+\s+(gemini\.md|agents\.md|mcp|context)/i;

export function countLetters(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
}

/** Turn raw terminal text into a clean answer: drop box borders, empty prompt lines and UI hints. */
export function cleanReplyText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[│┃╭╮╰╯─━┏┓┗┛▐▌▛▜▝▘]/g, ' ').trim())
    .filter((line) => countLetters(line) >= 2 && !CHROME_LINE_RE.test(line) && !/^[>❯›]\s*$/.test(line))
    .join('\n')
    .trim();
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keep only what the agent printed AFTER the echo of the prompt we sent.
 * Windows ConPTY sometimes repaints the whole visible screen (old output included) when text scrolls;
 * without this, that old text was relayed to teammates as if it were the agent's answer.
 */
export function stripEchoedPrompt(buffer: string, sentPrompt: string): string {
  if (!sentPrompt) return buffer;
  // Compare only plain ASCII letters/digits: terminals may alter accents, "·", commas or wrap lines.
  const plain = (text: string) => text.normalize('NFD').replace(/[^A-Za-z0-9]/g, '');
  const marker = plain(sentPrompt).slice(-40); // long enough that an answer quoting the question can't match
  if (marker.length < 4) return buffer;
  let compact = '';
  const indexMap: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    for (const ch of plain(buffer[i])) {
      compact += ch;
      indexMap.push(i);
    }
  }
  const pos = compact.lastIndexOf(marker);
  if (pos < 0) return buffer;
  const rest = buffer.slice(indexMap[pos + marker.length - 1] + 1);
  // The marker ends on the last letter/digit: also drop the prompt's final punctuation ("." "?" "…").
  const trailing = sentPrompt.normalize('NFD').match(/[^A-Za-z0-9]*$/)?.[0].trim() ?? '';
  const afterSpaces = rest.replace(/^[ \t]+/, '');
  return trailing && afterSpaces.startsWith(trailing) ? afterSpaces.slice(trailing.length) : rest;
}

/**
 * The CLI printed an account/API error instead of an answer (no credits, bad key, quota…).
 * Returns a short French explanation, or null when the reply looks like a real answer.
 * Such errors must never be relayed to teammates as if they were a reply.
 */
export function detectCliFailure(reply: string): string | null {
  const text = reply.slice(0, 1500);
  // A long answer that merely talks about HTTP errors is still an answer: only short replies,
  // or replies that start like an error, are treated as failures.
  const looksLikeError = /^\s*[✕×✖!]?\s*\[?(api )?error\b|^\s*error:/i.test(text);
  if (!looksLikeError && text.length > 600) return null;
  if (/credits? (are |is )?(depleted|exhausted)|out of credits|insufficient[_ ]quota|credit balance is too low|payment required|(error|code|status)\W{0,4}402\b/i.test(text)) {
    return "Plus de crédits sur le compte de cette IA : recharge-le ou change de mode de connexion (ex. /auth pour Gemini CLI).";
  }
  if (/invalid[_ ]api[_ ]key|api key not valid|incorrect api key|(error|code|status)\W{0,4}401\b|authentication (failed|error)|please (log ?in|sign in|run \/login)/i.test(text)) {
    return "Connexion refusée : clé API invalide ou session expirée. Reconnecte-toi dans la console.";
  }
  if (/resource[_ ]exhausted|quota exceeded|rate[ _-]?limit(ed)?\b|too many requests|usage limit|(error|code|status)\W{0,4}429\b|\b429 too many/i.test(text)) {
    return 'Quota ou limite de requêtes atteint pour cette IA : attends un peu ou change de compte.';
  }
  if (/^\s*[✕×x✖]?\s*\[?api error\b/i.test(text)) {
    return "L'IA a renvoyé une erreur de son service au lieu d'une réponse.";
  }
  return null;
}
