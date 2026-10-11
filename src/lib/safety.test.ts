import { describe, expect, it } from 'vitest';
import { checkSafety, normalizeForSafety } from './safety';

describe('checkSafety', () => {
  const crisis = [
    'I want to kill myself',
    'Honestly I just want to end it all.',
    'some days I want to die',
    "There's no point in living anymore",
    'I keep thinking I might hurt myself',
    "I can't go on like this",
    'I can’t go on', // curly apostrophe
    'I CANNOT GO ON',
    'thinking about suicide',
    "I don't want to be alive",
    'everyone would be better off dead without me... I mean me',
    'I want to self-harm again',
    'KILL MYSELF',
  ];

  it.each(crisis)('flags "%s"', (text) => {
    expect(checkSafety(text).risk).toBe(true);
  });

  const calm = [
    'Long day at work, my boss was annoying but I survived.',
    'Calm day, read a book and made tea.',
    'It rained all day and I stayed in.',
    'This deadline is killing me lol',
    'I could go on about this movie forever',
    'The battery died on my phone',
  ];

  it.each(calm)('does not flag "%s"', (text) => {
    expect(checkSafety(text).risk).toBe(false);
  });

  it('normalizes apostrophes and punctuation', () => {
    expect(normalizeForSafety("Can't   GO-on!")).toBe('cant go on');
  });
});
