package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/rishavraj/media-service/internal/api"
	"github.com/rishavraj/media-service/internal/media"
	"github.com/rishavraj/media-service/internal/storage"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	ctx, stopSignals := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stopSignals()

	blob, err := storage.NewS3Storage(ctx, storage.S3Config{
		Bucket:          getenv("S3_BUCKET", "media-service-dev"),
		Region:          getenv("S3_REGION", "us-east-1"),
		Endpoint:        getenv("S3_ENDPOINT", "http://localhost:9000"),
		AccessKeyID:     getenv("S3_ACCESS_KEY_ID", "mediaservice"),
		SecretAccessKey: getenv("S3_SECRET_ACCESS_KEY", "mediaservice-dev-secret"),
		UsePathStyle:    getenvBool("S3_USE_PATH_STYLE", true),
	})
	if err != nil {
		logger.Error("failed to initialize storage", "error", err)
		os.Exit(1)
	}

	if getenvBool("S3_ENSURE_BUCKET", true) {
		if err := blob.EnsureBucket(ctx); err != nil {
			logger.Error("failed to ensure bucket exists", "error", err)
			os.Exit(1)
		}
	}

	store := media.NewMemoryStore()
	svc := media.NewService(store, blob)

	workerConcurrency := getenvInt("THUMBNAIL_WORKERS", 4)
	worker := media.NewWorker(store, blob, workerConcurrency, 256, logger)
	svc.OnNeedsProcessing(worker.Enqueue)
	worker.Start(ctx)

	serviceToken := getenv("SERVICE_TOKEN", "")
	if serviceToken == "" {
		serviceToken = "dev-only-insecure-token"
		logger.Warn("SERVICE_TOKEN not set, using an insecure dev default — do not run this in prod")
	}

	srv := api.NewServer(svc, serviceToken, logger)

	addr := ":" + getenv("PORT", "8081")
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("media-service listening", "addr", addr)
		serveErr <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server stopped", "error", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("http shutdown", "error", err)
		}
		worker.Stop()
	}
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getenvInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
