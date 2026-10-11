import { useEffect, useMemo, useState } from 'react';
import { Layout, type Screen } from './components/Layout';
import { CheckInScreen } from './components/CheckInScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SetupWizard } from './components/SetupWizard';
import { SproutIcon } from './components/SproutIcon';
import { WalkFlow } from './components/WalkFlow';
import { config } from './lib/config';
import type { CheckInEntry } from './lib/entries';
import { rulesStrategy } from './lib/nudge/rules';
import { pluginAgents } from './lib/registry';
import { defaultSettings, loadSettings, resolveProvider, resolveStrategy, saveSettings, type AppSettings } from './lib/settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [walkEntry, setWalkEntry] = useState<CheckInEntry | null>(null);
  // Bumped to remount the check-in screen with a fresh, empty form.
  const [checkInKey, setCheckInKey] = useState(0);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

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
        onExit={() => {
          setWalkEntry(null);
          navigate('home');
        }}
      />
    );
  }

  const firstRun = !settings.setupDone;

  return (
    <Layout screen={screen} onNavigate={navigate} fullBleed={screen === 'home' && !firstRun}>
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
      {screen === 'settings' && <SetupWizard initial={settings} registry={pluginAgents} firstRun={false} onSave={handleSave} />}
    </Layout>
  );
}
