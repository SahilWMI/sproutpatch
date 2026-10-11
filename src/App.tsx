import { useState } from 'react';
import { Layout, type Screen } from './components/Layout';
import { CheckInScreen } from './components/CheckInScreen';
import { config } from './lib/config';
import { rulesStrategy } from './lib/nudge/rules';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [walkNotice, setWalkNotice] = useState(false);

  return (
    <Layout screen={screen} onNavigate={setScreen}>
      {screen === 'home' && (
        <div className="space-y-4">
          <CheckInScreen
            provider={null}
            strategy={rulesStrategy}
            timeoutMs={config.timeoutMs}
            onStartWalk={() => setWalkNotice(true)}
          />
          {walkNotice && <p className="muted">The walk timer arrives in a later step. Go anyway!</p>}
        </div>
      )}
      {screen === 'history' && <p className="muted">Your history will show up here.</p>}
      {screen === 'settings' && <p className="muted">Settings are coming soon.</p>}
    </Layout>
  );
}
