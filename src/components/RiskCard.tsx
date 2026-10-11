import { SUPPORT_MESSAGE } from '../lib/safety';

interface RiskCardProps {
  trigger: 'keyword' | 'model';
  onDone: () => void;
}

export function RiskCard({ trigger, onDone }: RiskCardProps) {
  return (
    <section className="space-y-4" aria-labelledby="risk-heading" role="alert">
      <div className="card space-y-3">
        <h2 id="risk-heading" className="text-xl font-semibold text-mist-800 dark:text-mist-100">
          {SUPPORT_MESSAGE.heading}
        </h2>
        <p className="text-mist-700 dark:text-mist-300">{SUPPORT_MESSAGE.body}</p>
      </div>
      <div className="card border-amber-300 bg-amber-50 dark:border-amber-300/30 dark:bg-amber-300/10">
        <h3 className="mb-2 font-semibold text-amber-900 dark:text-amber-100">Please talk to someone now</h3>
        <p className="text-amber-900 dark:text-amber-100">{SUPPORT_MESSAGE.helpline}</p>
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">{SUPPORT_MESSAGE.reachOut}</p>
        <a
          href="tel:14416"
          className="btn mt-4 bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-300 dark:text-mist-950 dark:hover:bg-amber-200"
        >
          Call Tele-MANAS (14416)
        </a>
      </div>
      {trigger === 'model' && (
        <p className="muted">
          Your model flagged this check-in. Small models are sometimes overly cautious; if this doesn't fit how you feel, that's
          okay, and you can check in again any time.
        </p>
      )}
      <p className="muted">Only a mood score and a marker were saved for this check-in. Your words were not stored.</p>
      <button type="button" className="btn-secondary" onClick={onDone}>
        Back to start
      </button>
    </section>
  );
}
