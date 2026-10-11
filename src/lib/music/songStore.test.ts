import { describe, expect, it } from 'vitest';
import { isGeneratedTrack, normalizePrefs } from '../prefs';
import { isAudioFile, shuffled, songTitle } from './songStore';
import { trackTitle } from './soundtrack';

describe('my music', () => {
  it('accepts audio by MIME type or extension', () => {
    expect(isAudioFile({ name: 'song.mp3', type: '' })).toBe(true);
    expect(isAudioFile({ name: 'song.OGG', type: '' })).toBe(true);
    expect(isAudioFile({ name: 'voice', type: 'audio/webm' })).toBe(true);
    expect(isAudioFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isAudioFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
  });

  it('turns file names into song titles', () => {
    expect(songTitle('02 - Sunny Day.mp3')).toBe('02 - Sunny Day');
    expect(songTitle('no-extension')).toBe('no-extension');
    expect(songTitle('.mp3')).toBe('.mp3');
  });

  it('shuffles without losing or duplicating songs', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const out = shuffled(items, rand);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('has a "My music" track that is not generated', () => {
    expect(isGeneratedTrack('custom')).toBe(false);
    expect(isGeneratedTrack('meadow')).toBe(true);
    expect(trackTitle('custom')).toBe('My music');
    expect(trackTitle('night-grass')).toBe('Night Grass');
    expect(normalizePrefs({ track: 'custom' }).track).toBe('custom');
  });
});
