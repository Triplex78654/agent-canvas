import { describe, expect, it } from 'vitest';
import { pickStarterAgents } from '../src/lib/starterTeam';

const cli = (id: string, installed = true) => ({ id, binary: id, title: id, installHint: null, installed, path: null });

describe('pickStarterAgents', () => {
  it('prefers subscription CLIs and skips what is not installed', () => {
    expect(pickStarterAgents([cli('gemini'), cli('qwen'), cli('claude'), cli('codex', false)])).toEqual(['claude', 'qwen']);
  });
  it('puts Gemini CLI last (needs a paid API key since June 2026)', () => {
    expect(pickStarterAgents([cli('gemini'), cli('ollama')])).toEqual(['ollama', 'gemini']);
  });
  it('never pairs Ollama with DeepSeek (same engine)', () => {
    expect(pickStarterAgents([cli('ollama'), cli('deepseek')])).toEqual(['ollama']);
  });
  it('returns nothing when no AI is installed', () => {
    expect(pickStarterAgents([cli('claude', false)])).toEqual([]);
  });
});
