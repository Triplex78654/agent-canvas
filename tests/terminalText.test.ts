import { describe, expect, it } from 'vitest';
import {
  BLOCKING_DIALOG_RE,
  WORKING_RE,
  cleanReplyText,
  detectCliFailure,
  stripAnsi,
  stripEchoedPrompt,
} from '../src/lib/terminalText';

describe('stripAnsi', () => {
  it('removes colours and cursor moves', () => {
    expect(stripAnsi('\x1b[31mRouge\x1b[0m \x1b[2J\x1b[Hok')).toBe('Rouge ok');
  });
  it('removes window-title OSC sequences (used to leak "]0;C:\\WINDOWS…")', () => {
    expect(stripAnsi('\x1b]0;C:\\WINDOWS\\system32\\pwsh.exe\x07Bonjour')).toBe('Bonjour');
  });
  it('turns cursor-forward / erase-chars into spaces (Codex, ConPTY)', () => {
    expect(stripAnsi('Je\x1b[1Cpropose\x1b[3X«Mijotopia»')).toBe('Je propose   «Mijotopia»');
  });
  it('removes an OSC whose ESC arrived in the previous chunk', () => {
    expect(stripAnsi('avant ]0;titre\x07après')).toBe('avant après');
  });
});

describe('cleanReplyText', () => {
  it('drops box borders, empty prompts and CLI status lines', () => {
    const raw = [
      '╭──────────────╮',
      '│ La capitale de l’Italie est Rome. │',
      '╰──────────────╯',
      '❯ ',
      '? for shortcuts',
      '✻ Churned for 2s',
      'esc to interrupt',
      '1234 tokens',
    ].join('\n');
    expect(cleanReplyText(raw)).toBe('La capitale de l’Italie est Rome.');
  });
  it('keeps markdown bullets of a real answer', () => {
    const raw = '* Premier point important\n* Deuxième point important';
    expect(cleanReplyText(raw)).toBe(raw);
  });
  it('drops footer hints like auto mode and /model', () => {
    expect(cleanReplyText('auto mode on (shift+tab to cycle)\n/model to switch\nRéponse utile')).toBe('Réponse utile');
  });
});

describe('cleanReplyText on real CLI screens', () => {
  it('Codex: keeps the answer, drops the input placeholder and the model footer', () => {
    const screen = [
      '• La capitale de l’Australie est Canberra.',
      '',
      '  Worked for 1s • 22:09',
      '',
      '› Ask Codex to do anything',
      '',
      '  GPT-6-Luna high · ~ · Répondre sur la capitale australienne',
      '  ← for agents · ? for shortcuts',
    ].join('\n');
    expect(cleanReplyText(screen)).toBe('• La capitale de l’Australie est Canberra.');
  });
  it('Gemini CLI: keeps the answer, drops the input box and status footer', () => {
    const screen = [
      "✦ Canberra est la capitale de l'Australie.",
      '',
      ' Using: 1 GEMINI.md file',
      '╭──────────────────────────────────────────╮',
      '│ >   Type your message or @path/to/file    │',
      '╰──────────────────────────────────────────╯',
      '~                no sandbox (see /docs)          gemini-3.5-pro (99% context left)',
    ].join('\n');
    expect(cleanReplyText(screen)).toBe("✦ Canberra est la capitale de l'Australie.");
  });
  it('detects the Gemini CLI sign-in screen as a blocking dialog', () => {
    expect(BLOCKING_DIALOG_RE.test('How would you like to authenticate for this project?\n● 1. Sign in with Google')).toBe(true);
  });
});

describe('stripEchoedPrompt', () => {
  const prompt = 'Quelle est la capitale de l’Italie ? Réponds en un mot, sans détour, merci beaucoup à toi.';

  it('keeps only what follows the echoed prompt', () => {
    const buffer = `ancien texte\n> ${prompt}\nRome`;
    expect(stripEchoedPrompt(buffer, prompt).trim()).toBe('Rome');
  });
  it('matches even when the terminal decomposes accents and wraps lines', () => {
    const echoed = prompt.normalize('NFD').replace('merci', 'mer\nci');
    expect(stripEchoedPrompt(`> ${echoed}\nRome`, prompt).trim()).toBe('Rome');
  });
  it('uses the LAST echo (ConPTY repaints the screen with the old prompt)', () => {
    const buffer = `> ${prompt}\nvieille réponse\n> ${prompt}\nRome`;
    expect(stripEchoedPrompt(buffer, prompt).trim()).toBe('Rome');
  });
  it('drops the question mark that ends the prompt ("Italie ?")', () => {
    const q = 'Quelle est la capitale de l’Italie, réponds en un seul mot sans aucune phrase ?';
    expect(stripEchoedPrompt(`> ${q}\nRome`, q).trim()).toBe('Rome');
  });
  it('returns the buffer unchanged when the prompt is not found', () => {
    expect(stripEchoedPrompt('juste une réponse', prompt)).toBe('juste une réponse');
  });
  it('does not cut an answer that only repeats the end of a short word', () => {
    expect(stripEchoedPrompt('Rome', 'ok')).toBe('Rome');
  });
});

describe('screen detection', () => {
  it('detects blocking dialogs (folder trust, login)', () => {
    expect(BLOCKING_DIALOG_RE.test('Do you trust the files in this folder?')).toBe(true);
    expect(BLOCKING_DIALOG_RE.test('Select login method:')).toBe(true);
    expect(BLOCKING_DIALOG_RE.test('Would you like to run the following command?')).toBe(true);
    expect(BLOCKING_DIALOG_RE.test('Do you want to proceed?')).toBe(true);
    expect(BLOCKING_DIALOG_RE.test('Rome est la capitale.')).toBe(false);
  });
  it('detects a CLI that is still working', () => {
    expect(WORKING_RE.test('✻ Thinking… (esc to interrupt)')).toBe(true);
    expect(WORKING_RE.test('> ')).toBe(false);
  });
});

describe('detectCliFailure', () => {
  it('recognises the Gemini "prepayment credits are depleted" error (402)', () => {
    const screen =
      '✕ [API Error: {"error":{"message":"{\\n \\"error\\": {\\n \\"code\\": 402, \\"message\\": \\"Your prepayment credits are depleted.\\", \\"status\\": \\"RESOURCE_EXHAUSTED\\"}}","code":402,"status":"Payment Required"}}]';
    expect(detectCliFailure(cleanReplyText(screen))).toMatch(/crédits/);
  });
  it('recognises invalid keys and rate limits', () => {
    expect(detectCliFailure('Error: Incorrect API key provided')).toMatch(/clé API/);
    expect(detectCliFailure('429 Too Many Requests')).toMatch(/Quota/);
  });
  it('leaves normal answers alone', () => {
    expect(detectCliFailure('La capitale de l’Australie est Canberra.')).toBeNull();
    expect(detectCliFailure('Voici une fonction qui gère les erreurs HTTP proprement.')).toBeNull();
    expect(detectCliFailure('Le serveur répond 401 si le token manque, 429 si on spamme.')).toBeNull();
    expect(detectCliFailure('Explication : ' + 'les erreurs unauthorized et rate limit arrivent quand... '.repeat(15))).toBeNull();
  });
});
