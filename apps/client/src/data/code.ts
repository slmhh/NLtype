export const codeSnippets: string[] = [
  `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(result);`,

  `import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}`,

  `class QuickSort {
  static sort<T>(arr: T[], lo = 0, hi = arr.length - 1): T[] {
    if (lo >= hi) return arr;
    const pivot = partition(arr, lo, hi);
    QuickSort.sort(arr, lo, pivot - 1);
    QuickSort.sort(arr, pivot + 1, hi);
    return arr;
  }
}`,

  `const express = require("express");
const app = express();

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello World" });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});`,

  `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`,

  `.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: "JetBrains Mono", monospace;
}`,

  `interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}`,

  `package main

import "fmt"

func main() {
  msg := make(chan string)

  go func() {
    msg <- "Hello from goroutine"
  }()

  fmt.Println(<-msg)
}`,
];

export function getRandomCodeSnippet(): string {
  return codeSnippets[Math.floor(Math.random() * codeSnippets.length)];
}
