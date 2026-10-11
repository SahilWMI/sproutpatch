const TEMPLATES: Record<'low' | 'meh' | 'good', readonly string[]> = {
  low: [
    "That sounds like a heavy day. Thanks for putting it into words; a little air might take the edge off.",
    "Rough one. You got through it, and that counts for something. Let's get you outside for a bit.",
    "Days like this are tiring. No need to fix anything right now, just a short break from the screen.",
  ],
  meh: [
    "Sounds like a so-so kind of day. A few minutes outside can reset things a little.",
    "Thanks for checking in. Middle-of-the-road days are good days for a small walk.",
    "Noted. Nothing dramatic, and that's fine. Some fresh air could be a nice punctuation mark.",
  ],
  good: [
    "Love that. Let's keep the good streak going with a bit of time outdoors.",
    "Sounds like a good day. Take it outside for a few minutes and enjoy it.",
    "Nice to hear. A quick loop outside would round it off well.",
  ],
};

export function templateReply(moodScore: number, seed = 0): string {
  const band = moodScore <= -1 ? 'low' : moodScore <= 0 ? 'meh' : 'good';
  const list = TEMPLATES[band];
  const index = ((Math.trunc(seed) % list.length) + list.length) % list.length;
  return list[index] ?? list[0]!;
}
