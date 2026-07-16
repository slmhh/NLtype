export const quotes: string[] = [
  `Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.`,
  "The only way to do great work is to love what you do.",
  "Simplicity is the ultimate sophistication.",
  "In the middle of difficulty lies opportunity.",
  "First, solve the problem. Then, write the code.",
  "Talk is cheap. Show me the code.",
  "Code is like humor. When you have to explain it, it's bad.",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
  "Programs must be written for people to read, and only incidentally for machines to execute.",
  "The best way to predict the future is to invent it.",
  "Stay hungry, stay foolish.",
  "Make it work, make it right, make it fast.",
  "The most disastrous thing that you can ever learn is your first programming language.",
  "One man's constant is another man's variable.",
  "Programming is the art of telling another human being what one wants the computer to do.",
  "Before software can be reusable it first has to be usable.",
];

export function getRandomQuote(): string {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
