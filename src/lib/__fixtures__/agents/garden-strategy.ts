import type { NudgeStrategy } from '../../types';

const gardenStrategy: NudgeStrategy = {
  id: 'fixture-garden',
  label: 'Fixture garden strategy',
  suggest: () => ({
    strategyId: 'fixture-garden',
    rule: 'light',
    suggestion: 'Water a plant outside.',
    minutes: 5,
    reason: 'Fixture',
  }),
};

export default gardenStrategy;
