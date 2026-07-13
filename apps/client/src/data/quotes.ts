export const quotes: string[] = [
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
