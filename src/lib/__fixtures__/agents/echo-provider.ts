import type { Provider } from '../../types';

const echoProvider: Provider = {
  id: 'fixture-echo',
  label: 'Fixture echo provider',
  async checkIn() {
    return { raw: { mood_score: 0, themes: [], risk_flag: false, reply: 'echo' } };
  },
};

export default echoProvider;
