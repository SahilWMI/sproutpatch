import type { ChatMessage } from '../../lib/types';

/**
 * Gemma's chat format. Gemma has no system role, so system text is folded into the first user
 * turn; the prompt ends with an open model turn for the reply.
 */
export function formatGemmaPrompt(messages: readonly ChatMessage[]): string {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content.trim());
  const turns = messages.filter((m) => m.role !== 'system');
  let prefix = system.length ? `${system.join('\n\n')}\n\n` : '';
  const parts = turns.map((m) => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    let content = m.content.trim();
    if (role === 'user' && prefix) {
      content = prefix + content;
      prefix = '';
    }
    return `<start_of_turn>${role}\n${content}<end_of_turn>\n`;
  });
  if (prefix) parts.unshift(`<start_of_turn>user\n${prefix.trim()}<end_of_turn>\n`);
  return `${parts.join('')}<start_of_turn>model\n`;
}

/** Small models sometimes keep going past their turn; keep only the first reply. */
export function cleanGemmaReply(text: string): string {
  const cut = text.split(/<end_of_turn>|<start_of_turn>/)[0] ?? '';
  return cut.trim();
}
