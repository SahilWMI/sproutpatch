import { SUPPORT_MESSAGE } from '../lib/safety';

interface RiskCardProps {
  onDone: () => void;
}

export function RiskCard({ onDone }: RiskCardProps) {
  return (
    <section className="space-y-4" aria-labelledby="risk-heading" role="alert">
      <div className="card space-y-3">
        <h2 id="risk-heading" className="text-xl font-semibold text-stone-800 dark:text-stone-100">
          {SUPPORT_MESSAGE.heading}
        </h2>
        <p className="text-stone-700 dark:text-stone-300">{SUPPORT_MESSAGE.body}</p>
      </div>
      <div className="card border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <h3 className="mb-2 font-semibold text-amber-900 dark:text-amber-100">Please talk to someone now</h3>
        <p className="text-amber-900 dark:text-amber-100">{SUPPORT_MESSAGE.helpline}</p>
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">{SUPPORT_MESSAGE.reachOut}</p>
        <a
          href="tel:14416"
          className="btn mt-4 bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
        >
          Call Tele-MANAS (14416)
        </a>
      </div>
      <p className="muted">Only a mood score and a marker were saved for this check-in. Your words were not stored.</p>
      <button type="button" className="btn-secondary" onClick={onDone}>
        Back to start
      </button>
    </section>
  );
}
