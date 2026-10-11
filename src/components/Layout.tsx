import type { ReactNode } from 'react';
import { SproutIcon } from './SproutIcon';

export type Screen = 'home' | 'history' | 'settings';

interface LayoutProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  /** Edge-to-edge content that brings its own footer (the check-in screen). */
  fullBleed?: boolean;
  children: ReactNode;
}

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Check in' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export function Layout({ screen, onNavigate, fullBleed = false, children }: LayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm dark:focus:bg-stone-900"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/75">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex min-h-11 items-center gap-1.5 rounded-lg text-base font-semibold text-sprout-700 sm:gap-2 sm:text-lg dark:text-sprout-300"
          >
            <SproutIcon className="h-7 w-7 text-sprout-600 dark:text-sprout-400" />
            <span className="max-[360px]:sr-only">Sproutpatch</span>
          </button>
          <nav aria-label="Main">
            <ul className="flex gap-0.5 sm:gap-1">
              {NAV.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={screen === item.id ? 'page' : undefined}
                    className={`min-h-11 rounded-lg px-2.5 text-sm transition-colors sm:px-3 ${
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
      <main
        id="main"
        className={fullBleed ? 'flex w-full flex-1 flex-col' : 'mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-10'}
      >
        {children}
      </main>
      {!fullBleed && <Footer />}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-stone-200 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
      Sproutpatch is not a therapist or a medical tool.
    </footer>
  );
}
