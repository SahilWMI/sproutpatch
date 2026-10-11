import type { ReactNode } from 'react';
import { SproutIcon } from './SproutIcon';

export type Screen = 'home' | 'history' | 'settings';

interface LayoutProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  children: ReactNode;
}

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Check in' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export function Layout({ screen, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm dark:focus:bg-stone-900"
      >
        Skip to content
      </a>
      <header className="border-b border-stone-200 bg-white/70 backdrop-blur dark:border-stone-800 dark:bg-stone-900/60">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 rounded-lg text-lg font-semibold text-sprout-700 dark:text-sprout-300"
          >
            <SproutIcon className="h-7 w-7 text-sprout-600 dark:text-sprout-400" />
            Sproutpatch
          </button>
          <nav aria-label="Main">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={screen === item.id ? 'page' : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      screen === item.id
                        ? 'bg-sprout-100 font-medium text-sprout-800 dark:bg-sprout-900 dark:text-sprout-100'
                        : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-stone-200 py-4 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
      Sproutpatch is not a therapist or a medical tool.
    </footer>
  );
}
