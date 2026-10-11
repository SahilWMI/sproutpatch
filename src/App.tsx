import { useEffect, useMemo, useState } from 'react';
import { Layout, type Screen } from './components/Layout';
import { CheckInScreen } from './components/CheckInScreen';
import { SetupWizard } from './components/SetupWizard';
import { SproutIcon } from './components/SproutIcon';
import { config } from './lib/config';
import { rulesStrategy } from './lib/nudge/rules';
import { pluginAgents } from './lib/registry';
import { loadSettings, resolveProvider, resolveStrategy, saveSettings, type AppSettings } from './lib/settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [walkNotice, setWalkNotice] = useState(false);

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

  if (!settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <SproutIcon className="h-10 w-10 animate-pulse text-sprout-600" title="Loading Sproutpatch" />
      </div>
    );
  }

  const firstRun = !settings.setupDone;

  return (
    <Layout screen={screen} onNavigate={setScreen}>
      {screen === 'home' && firstRun && (
        <SetupWizard initial={settings} registry={pluginAgents} firstRun onSave={handleSave} />
      )}
      {screen === 'home' && !firstRun && (
        <div className="space-y-4">
          <CheckInScreen
            provider={provider}
            strategy={strategy}
            timeoutMs={config.timeoutMs}
            onStartWalk={() => setWalkNotice(true)}
          />
          {walkNotice && <p className="muted">The walk timer arrives in a later step. Go anyway!</p>}
        </div>
      )}
      {screen === 'history' && <p className="muted">Your history will show up here.</p>}
      {screen === 'settings' && (
        <SetupWizard initial={settings} registry={pluginAgents} firstRun={false} onSave={handleSave} />
      )}
    </Layout>
  );
}
