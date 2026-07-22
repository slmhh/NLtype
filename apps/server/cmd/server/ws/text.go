package ws

import (
	"math/rand/v2"
	"strings"
)

var builtinWords = []string{
	"the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
	"pack", "my", "box", "with", "five", "dozen", "liquor", "jugs",
	"how", "vexingly", "daft", "zebras", "jump", "boxing", "wizards",
	"sphinx", "black", "quartz", "judge", "vow", "river", "bank",
	"testing", "purpose", "word", "speed", "typing", "practice",
	"keyboard", "letter", "character", "sentence", "text", "game",
	"score", "high", "level", "time", "minute", "second", "fast",
	"slow", "accuracy", "cryptic", "gazebo", "jovial", "mystify",
	"pickled", "sprite", "trombone", "unicorn", "vortex", "waltz",
	"blitz", "dwarves", "fjord", "gypsy", "haiku", "jazz", "kayak",
	"luxury", "nymph", "photo", "sphinx", "swivel", "topaz", "zephyr",
}

var builtinModeWordCount = map[GameMode]int{
	ModeAccuracy:    15,
	ModeChase:       60,
	ModeMarathon:    10,
	ModeTimeBattle:  50,
	ModeElimination: 35,
}

func generateGameText(settings RoomSettings) string {
	n, ok := builtinModeWordCount[settings.Mode]
	if !ok {
		n = 40
	}
	words := make([]string, n)
	for i := range words {
		words[i] = builtinWords[rand.IntN(len(builtinWords))]
	}
	s := strings.Join(words, " ")
	if settings.Mode == ModeAccuracy {
		if len(s) > 0 {
			s = strings.ToUpper(s[:1]) + s[1:] + "."
		}
	}
	return s
}
