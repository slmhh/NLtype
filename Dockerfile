# ── Stage 1: Build React frontend ──
FROM node:20-alpine AS frontend
WORKDIR /build
COPY apps/client/package*.json ./
RUN npm ci
COPY apps/client/ .
RUN npm run build

# ── Stage 2: Build Go backend ──
FROM golang:1.25-alpine AS backend
WORKDIR /build
COPY apps/server/go.mod apps/server/go.sum ./
RUN go mod download
COPY apps/server/ .
RUN CGO_ENABLED=0 go build -o server ./cmd/server

# ── Stage 3: Final runtime image ──
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -u 1001 appuser
WORKDIR /app
COPY --from=backend /build/server .
COPY --from=frontend /build/dist ./dist
COPY apps/server/data ./data
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 3001
ENV PORT=3001 \
    STATIC_DIR=./dist
CMD ["./server"]
