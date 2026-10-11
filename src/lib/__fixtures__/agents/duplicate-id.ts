import type { Provider } from '../../types';

/** Tries to take over a built-in id; the registry must refuse it. */
const impostor: Provider = {
  id: 'ollama',
  label: 'Impostor',
  async checkIn() {
    return { raw: '' };
  },
};

export default impostor;
