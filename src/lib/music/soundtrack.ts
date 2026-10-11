import { isGeneratedTrack, type TrackId } from '../prefs';
import { TRACKS } from './composition';
import { customMusic } from './customPlayer';
import { music } from './player';

export const CUSTOM_TRACK_TITLE = 'My music';

export function trackTitle(id: TrackId): string {
  return isGeneratedTrack(id) ? TRACKS[id].title : CUSTOM_TRACK_TITLE;
}

/** Starts the chosen track and silences the other player. */
export function playTrack(id: TrackId): void {
  if (isGeneratedTrack(id)) {
    customMusic.stop();
    music.play(id);
  } else {
    music.stop();
    // Don't restart from the first file if the user just picked a song in the list.
    if (customMusic.currentId) customMusic.resume();
    else void customMusic.play();
  }
}

export function stopAllMusic(): void {
  music.stop();
  customMusic.stop();
}
