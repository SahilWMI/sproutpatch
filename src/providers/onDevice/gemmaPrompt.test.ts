import { describe, expect, it } from 'vitest';
import { buildCheckInMessages } from '../../lib/prompt';
import { cleanGemmaReply, formatGemmaPrompt } from './gemmaPrompt';

describe('formatGemmaPrompt', () => {
  it('folds the system prompt into the first user turn and opens a model turn', () => {
    const prompt = formatGemmaPrompt([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: '{"ok":true}' },
      { role: 'user', content: 'Again' },
    ]);
    expect(prompt).toBe(
      '<start_of_turn>user\nBe brief.\n\nHi<end_of_turn>\n' +
        '<start_of_turn>model\n{"ok":true}<end_of_turn>\n' +
        '<start_of_turn>user\nAgain<end_of_turn>\n' +
        '<start_of_turn>model\n',
    );
  });

  it('never emits a system role and keeps the note last', () => {
    const prompt = formatGemmaPrompt(buildCheckInMessages('Long day at work.'));
    expect(prompt).not.toContain('system');
    expect(prompt.trimEnd().endsWith('Long day at work.<end_of_turn>\n<start_of_turn>model')).toBe(true);
    expect(prompt.match(/<start_of_turn>model\n/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('handles a system-only prompt', () => {
    expect(formatGemmaPrompt([{ role: 'system', content: 'Say hi.' }])).toBe('<start_of_turn>user\nSay hi.<end_of_turn>\n<start_of_turn>model\n');
  });
});

describe('cleanGemmaReply', () => {
  it('keeps only the first turn', () => {
    expect(cleanGemmaReply(' {"a":1}<end_of_turn>\n<start_of_turn>user\nmore')).toBe('{"a":1}');
    expect(cleanGemmaReply('plain')).toBe('plain');
  });
});
