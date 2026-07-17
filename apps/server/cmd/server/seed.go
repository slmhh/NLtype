package main

import "log"

var seedCodeSnippets = []struct {
	CodeLang string
	Content  string
}{
	{
		CodeLang: "typescript",
		Content:  `function greet(name: string): string {` + "\n" + `  return \` + "`" + `Hello, ${name}!` + "`" + `;` + "\n" + `}` + "\n" + `\nconsole.log(greet("World"));`,
	},
	{
		CodeLang: "javascript",
		Content:  `console.log("Hello, World!");`,
	},
	{
		CodeLang: "python",
		Content:  `print("Hello, World!")`,
	},
	{
		CodeLang: "rust",
		Content:  "fn main() {\n    println!(\"Hello, World!\");\n}",
	},
	{
		CodeLang: "go",
		Content:  "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}",
	},
	{
		CodeLang: "c",
		Content:  "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}",
	},
	{
		CodeLang: "cpp",
		Content:  "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}",
	},
	{
		CodeLang: "csharp",
		Content:  "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, World!\");\n    }\n}",
	},
	{
		CodeLang: "html",
		Content:  "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>",
	},
	{
		CodeLang: "css",
		Content:  "body::after {\n  content: \"Hello, World!\";\n  display: block;\n  text-align: center;\n  font-size: 2rem;\n  margin-top: 40vh;\n}",
	},
	{
		CodeLang: "sql",
		Content:  "CREATE TABLE greetings (\n    id INTEGER PRIMARY KEY,\n    message TEXT NOT NULL\n);\n\nINSERT INTO greetings (message)\nVALUES ('Hello, World!');\n\nSELECT message FROM greetings;",
	},
}

func seedCodeEntries() {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM entries WHERE language = 'code'").Scan(&count)
	if err != nil {
		log.Printf("seed: count code entries: %v", err)
		return
	}
	if count > 0 {
		log.Printf("seed: code entries already exist (%d), skipping", count)
		return
	}

	for _, s := range seedCodeSnippets {
		_, err := db.Exec(
			`INSERT INTO entries (user_id, username, language, code_lang, content, status, created_at, reviewed_at, reviewed_by)
			 VALUES (0, 'system', 'code', ?, ?, 'approved', datetime('now'), datetime('now'), 0)`,
			s.CodeLang, s.Content,
		)
		if err != nil {
			log.Printf("seed: insert %s: %v", s.CodeLang, err)
		} else {
			log.Printf("seed: inserted %s hello world snippet", s.CodeLang)
		}
	}
}
