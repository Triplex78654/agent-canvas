import { describe, expect, it, vi } from 'vitest';

// The bus notifies the UI through window events: a bare EventTarget is enough outside the browser.
vi.stubGlobal('window', new EventTarget());
import {
  formatTeammateRelayPrompt,
  parseProjectTaskPlan,
  recordInterAgentMessage,
  getTeamInterAgentMessages,
  sanitizeTerminalOutputForRelay,
} from '../src/services/teamCollabBus';

describe('relay text', () => {
  it('strips escape codes and window titles before relaying', () => {
    expect(sanitizeTerminalOutputForRelay('\x1b]0;C:\\WINDOWS\x07\x1b[32mRome\x1b[0m\n\n')).toBe('Rome');
  });
  it('keeps the spaces Codex draws with cursor moves', () => {
    expect(sanitizeTerminalOutputForRelay('Je\x1b[1Cpropose\x1b[1C«Mijotopia»')).toBe('Je propose «Mijotopia»');
  });
  it('builds a single-line relay prompt (multi-line prompts submit partial lines in CLIs)', () => {
    const prompt = formatTeammateRelayPrompt('Claude', 'claude', 'ligne 1\nligne 2', 'Vérifie.');
    expect(prompt).not.toMatch(/\n/);
    expect(prompt).toContain('ligne 1 ligne 2');
  });
});

describe('parseProjectTaskPlan', () => {
  const members = [
    { id: 'a', label: 'Claude', commandType: 'claude' },
    { id: 'b', label: 'Gemini', commandType: 'gemini' },
  ] as any;
  it('reads the JSON plan even after an echoed example', () => {
    const reply = 'Exemple : {"foo": 1}\nPlan : {"tasks":[{"agentId":"a","task":"Écrire le backend"},{"agentId":"b","task":"Écrire les tests"}]}';
    const plan = parseProjectTaskPlan(reply, members);
    expect(plan?.get('a')).toBe('Écrire le backend');
    expect(plan?.get('b')).toBe('Écrire les tests');
  });
  it('ignores unknown agents and returns null without a plan', () => {
    expect(parseProjectTaskPlan('{"tasks":[{"agentId":"zz","task":"quelque chose"}]}', members)).toBeNull();
    expect(parseProjectTaskPlan('pas de json', members)).toBeNull();
  });
});

describe('recordInterAgentMessage', () => {
  it('ignores the duplicate React StrictMode records', () => {
    const msg = { teamId: 't-dedupe', fromNodeId: 'a', toNodeId: 'b', summaryText: 'Rome', timestamp: '10:00' } as any;
    recordInterAgentMessage(msg);
    recordInterAgentMessage({ ...msg });
    expect(getTeamInterAgentMessages('t-dedupe')).toHaveLength(1);
  });
});
