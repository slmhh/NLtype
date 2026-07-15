package main

import (
	"sync"
	"testing"
	"time"
)

func resetRateLimit() {
	rateMu.Lock()
	rateLimit = make(map[int]*rateRecord)
	rateMu.Unlock()
}

func TestCheckRateLimitAllowsWithinLimit(t *testing.T) {
	resetRateLimit()
	for i := 0; i < 20; i++ {
		if !checkRateLimit(1, 20) {
			t.Fatalf("iteration %d: expected true, got false", i)
		}
	}
}

func TestCheckRateLimitBlocksAfterLimit(t *testing.T) {
	resetRateLimit()
	userID := 42
	for i := 0; i < 20; i++ {
		checkRateLimit(userID, 20)
	}
	if checkRateLimit(userID, 20) {
		t.Fatal("expected false after exceeding limit")
	}
}

func TestCheckRateLimitDifferentUsers(t *testing.T) {
	resetRateLimit()
	for i := 0; i < 20; i++ {
		checkRateLimit(1, 20)
	}
	// A different user should not be blocked
	if !checkRateLimit(2, 20) {
		t.Fatal("expected true for different user")
	}
}

func TestCheckRateLimitResetsAfterHour(t *testing.T) {
	resetRateLimit()
	userID := 99
	for i := 0; i < 20; i++ {
		checkRateLimit(userID, 20)
	}
	if checkRateLimit(userID, 20) {
		t.Fatal("expected false before reset")
	}
	// Manually expire the record
	rateMu.Lock()
	rateLimit[userID] = &rateRecord{count: 20, resetAt: time.Now().UnixMilli() - 1}
	rateMu.Unlock()
	if !checkRateLimit(userID, 20) {
		t.Fatal("expected true after reset window expired")
	}
}

func TestCheckRateLimitConcurrentSafe(t *testing.T) {
	resetRateLimit()
	userID := 7
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			checkRateLimit(userID, 20)
		}()
	}
	wg.Wait()
	if checkRateLimit(userID, 20) {
		t.Fatal("expected false after 20 concurrent calls")
	}
}
