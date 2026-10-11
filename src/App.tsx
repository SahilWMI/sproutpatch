import { useState } from 'react';
import { Layout, type Screen } from './components/Layout';
import { HomeScreen } from './components/HomeScreen';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [lastNote, setLastNote] = useState<string | null>(null);

  return (
    <Layout screen={screen} onNavigate={setScreen}>
      {screen === 'home' && (
        <div className="space-y-6">
          <HomeScreen onSubmit={setLastNote} />
          {lastNote && (
            <div className="card" role="status">
              <p className="muted">Check-in received. The reply engine arrives in the next step.</p>
            </div>
          )}
        </div>
      )}
      {screen === 'history' && <p className="muted">Your history will show up here.</p>}
      {screen === 'settings' && <p className="muted">Settings are coming soon.</p>}
    </Layout>
  );
}
