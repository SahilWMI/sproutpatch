import { useEffect, useMemo, useState } from 'react';
import { Layout, type Screen } from './components/Layout';
import { CheckInScreen } from './components/CheckInScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { PreferencesPanel } from './components/PreferencesPanel';
import { MusicToggle, ThemeToggle } from './components/QuickToggles';
import { SetupWizard } from './components/SetupWizard';
import { SproutIcon } from './components/SproutIcon';
import { WalkFlow } from './components/WalkFlow';
import { config } from './lib/config';
import type { CheckInEntry } from './lib/entries';
import { music } from './lib/music/player';
import { rulesStrategy } from './lib/nudge/rules';
import { DEFAULT_PREFS, applyTheme, loadPrefs, nextThemeMode, resolveTheme, savePrefs, type Prefs } from './lib/prefs';
import { pluginAgents } from './lib/registry';
import { defaultSettings, loadSettings, resolveProvider, resolveStrategy, saveSettings, type AppSettings } from './lib/settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [walkEntry, setWalkEntry] = useState<CheckInEntry | null>(null);
  // Bumped to remount the check-in screen with a fresh, empty form.
  const [checkInKey, setCheckInKey] = useState(0);

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadPrefs().then(setPrefs);
  }, []);

  useEffect(() => {
    applyTheme(resolveTheme(prefs.theme, clock));
    if (prefs.theme !== 'auto') return;
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [prefs.theme, clock]);

  useEffect(() => {
    if (prefs.musicOn) music.play(prefs.track);
    else music.stop();
  }, [prefs.musicOn, prefs.track]);

  useEffect(() => {
    music.setVolume(prefs.volume);
  }, [prefs.volume]);

  useEffect(() => {
    // Browsers only allow sound after a user gesture; resume on the first one.
    const unlock = () => music.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  function updatePrefs(next: Prefs) {
    setPrefs(next);
    void savePrefs(next);
  }

  const toggleMusic = () => updatePrefs({ ...prefs, musicOn: !prefs.musicOn });

  const provider = useMemo(() => (settings ? resolveProvider(settings, pluginAgents) : null), [settings]);
  const strategy = useMemo(() => (settings ? resolveStrategy(settings, pluginAgents) : rulesStrategy), [settings]);

  async function handleSave(next: AppSettings) {
    try {
      await saveSettings(next);
    } catch {
      // Still use the choice for this session even if the browser blocks IndexedDB.
    }
    setSettings(next);
    if (screen !== 'settings') setScreen('home');
  }

  function navigate(next: Screen) {
    if (next === 'home') setCheckInKey((k) => k + 1);
    setScreen(next);
  }

  if (!settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <SproutIcon className="h-10 w-10 animate-pulse text-sprout-600" title="Loading Sproutpatch" />
      </div>
    );
  }

  if (walkEntry) {
    return (
      <WalkFlow
        entry={walkEntry}
        musicOn={prefs.musicOn}
        onToggleMusic={toggleMusic}
        onExit={() => {
          setWalkEntry(null);
          navigate('home');
        }}
      />
    );
  }

  const firstRun = !settings.setupDone;

  return (
    <Layout
      screen={screen}
      onNavigate={navigate}
      fullBleed={screen === 'home' && !firstRun}
      actions={
        <>
          <ThemeToggle mode={prefs.theme} onCycle={() => updatePrefs({ ...prefs, theme: nextThemeMode(prefs.theme) })} />
          <MusicToggle on={prefs.musicOn} onToggle={toggleMusic} />
        </>
      }
    >
      {screen === 'home' && firstRun && <SetupWizard initial={settings} registry={pluginAgents} firstRun onSave={handleSave} />}
      {screen === 'home' && !firstRun && (
        <CheckInScreen
          key={checkInKey}
          provider={provider}
          strategy={strategy}
          timeoutMs={config.timeoutMs}
          onStartWalk={setWalkEntry}
        />
      )}
      {screen === 'history' && <HistoryScreen onDataDeleted={() => setSettings(defaultSettings())} />}
      {screen === 'settings' && (
        <>
          <SetupWizard initial={settings} registry={pluginAgents} firstRun={false} onSave={handleSave} />
          <PreferencesPanel prefs={prefs} onChange={updatePrefs} />
        </>
      )}
    </Layout>
  );
}
