package main

import (
	"net/http"
	"strings"
)

// ── Middleware types ──

type Middleware func(http.Handler) http.Handler

// ── Route grouping ──

type routeGroup struct {
	prefix     string
	middleware []Middleware
}

func newGroup(prefix string, mw ...Middleware) *routeGroup {
	return &routeGroup{prefix: prefix, middleware: mw}
}

func (g *routeGroup) register(mux *http.ServeMux, pattern string, handler http.HandlerFunc) {
	// pattern has format "METHOD /path", e.g. "GET /me"
	// we want "METHOD /prefix/path", e.g. "GET /api/auth/me"
	space := strings.IndexByte(pattern, ' ')
	if space < 0 {
		panic("invalid pattern: " + pattern)
	}
	method := pattern[:space]
	path := strings.TrimRight(pattern[space+1:], "/")
	var full string
	if path == "" {
		full = method + " " + g.prefix
	} else {
		full = method + " " + g.prefix + path
	}
	chain := handler
	for i := len(g.middleware) - 1; i >= 0; i-- {
		chain = g.middleware[i](http.HandlerFunc(chain)).ServeHTTP
	}
	mux.HandleFunc(full, chain)
}

// ── Common middleware chains ──

func requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := getAuthUser(r)
		if claims == nil {
			writeError(w, 401, "Authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireRole(roles ...string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := getAuthUser(r)
			if claims == nil {
				writeError(w, 401, "Authentication required")
				return
			}
			for _, role := range roles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, 403, "Insufficient permissions")
		})
	}
}

func limitBodyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limitBody(r)
		next.ServeHTTP(w, r)
	})
}
