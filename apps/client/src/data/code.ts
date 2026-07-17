export type CodeLang = "typescript" | "javascript" | "python" | "rust" | "go" | "c" | "cpp" | "csharp" | "html" | "css" | "sql";

export const codeSnippets: Record<CodeLang, string[]> = {
  typescript: [
    `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,
  ],
  javascript: [
    `console.log("Hello, World!");`,
  ],
  python: [
    `print("Hello, World!")`,
  ],
  rust: [
    `fn main() {
    println!("Hello, World!");
}`,
  ],
  go: [
    `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
  ],
  c: [
    `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`,
  ],
  cpp: [
    `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`,
  ],
  csharp: [
    `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`,
  ],
  html: [
    `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>`,
  ],
  css: [
    `body::after {
  content: "Hello, World!";
  display: block;
  text-align: center;
  font-size: 2rem;
  margin-top: 40vh;
}`,
  ],
  sql: [
    `CREATE TABLE greetings (
    id INTEGER PRIMARY KEY,
    message TEXT NOT NULL
);

INSERT INTO greetings (message)
VALUES ('Hello, World!');

SELECT message FROM greetings;`,
  ],
};

export function getRandomCodeSnippet(lang: CodeLang): string {
  const pool = codeSnippets[lang];
  if (!pool || pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)];
}
