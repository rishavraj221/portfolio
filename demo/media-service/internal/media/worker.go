package media

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/rishavraj/media-service/internal/storage"
)

// Worker turns StatusProcessing records into StatusReady ones by generating
// a thumbnail. It's an in-process goroutine pool, not a separate queue
// service (SQS, etc.) — the honest v1 shape for a single-node deployment,
// same as Wavelink's local PubSub. The two things that keep it safe despite
// being in-process: enqueue never blocks the HTTP request that triggered it
// (a full queue just means the sweep picks the job up later), and the sweep
// itself makes every job at-least-once even if an enqueue was dropped or the
// process restarted mid-job.
type Worker struct {
	store       Store
	storage     storage.Storage
	logger      *slog.Logger
	jobs        chan string
	concurrency int

	sweepInterval time.Duration
	stop          chan struct{}
	done          chan struct{}
}

func NewWorker(store Store, blob storage.Storage, concurrency, queueSize int, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	if concurrency < 1 {
		concurrency = 1
	}
	if queueSize < 1 {
		queueSize = 1
	}
	return &Worker{
		store:         store,
		storage:       blob,
		logger:        logger,
		jobs:          make(chan string, queueSize),
		concurrency:   concurrency,
		sweepInterval: 30 * time.Second,
		stop:          make(chan struct{}),
		done:          make(chan struct{}, concurrency),
	}
}

// Enqueue schedules id for processing. It never blocks: if the queue is
// full, the job is dropped and left for the next sweep to pick up — a
// backed-up thumbnail worker should never slow down the HTTP path that
// completes an upload.
func (w *Worker) Enqueue(id string) {
	select {
	case w.jobs <- id:
	default:
		w.logger.Warn("thumbnail queue full, dropping enqueue — sweep will retry", "media_id", id)
	}
}

// Start launches the worker goroutines and the periodic sweep. It returns
// immediately; call Stop to shut down.
func (w *Worker) Start(ctx context.Context) {
	for i := 0; i < w.concurrency; i++ {
		go w.runLoop(ctx)
	}
	go w.sweepLoop(ctx)
}

func (w *Worker) runLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			w.done <- struct{}{}
			return
		case <-w.stop:
			w.done <- struct{}{}
			return
		case id := <-w.jobs:
			if err := w.processOne(ctx, id); err != nil {
				w.logger.Error("thumbnail processing failed", "media_id", id, "error", err)
			}
		}
	}
}

func (w *Worker) sweepLoop(ctx context.Context) {
	// Sweep once immediately so records left StatusProcessing by a crash
	// before this process's last restart get picked up without waiting a
	// full interval.
	w.sweep(ctx)

	ticker := time.NewTicker(w.sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stop:
			return
		case <-ticker.C:
			w.sweep(ctx)
		}
	}
}

func (w *Worker) sweep(ctx context.Context) {
	pending, err := w.store.ListByStatus(ctx, StatusProcessing)
	if err != nil {
		w.logger.Error("thumbnail sweep: list failed", "error", err)
		return
	}
	for _, m := range pending {
		w.Enqueue(m.ID)
	}
}

// Stop signals all goroutines to exit and waits for them.
func (w *Worker) Stop() {
	close(w.stop)
	for i := 0; i < w.concurrency; i++ {
		<-w.done
	}
}

// processOne does the actual decode/resize/encode/upload/update sequence for
// one Media record. Any failure marks the record StatusFailed rather than
// leaving it stuck in StatusProcessing forever — the original upload is left
// in storage untouched, so a fuller system could retry manually later; this
// v1 doesn't attempt automatic retries with backoff.
func (w *Worker) processOne(ctx context.Context, id string) error {
	m, err := w.store.Get(ctx, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil // deleted since being enqueued — nothing to do
		}
		return err
	}
	if m.Status != StatusProcessing {
		return nil // already handled by a previous run or a racing worker
	}

	body, _, err := w.storage.Get(ctx, m.StorageKey)
	if err != nil {
		return w.fail(ctx, m, err)
	}
	defer body.Close()

	img, err := decodeImage(m.ContentType, body)
	if err != nil {
		return w.fail(ctx, m, err)
	}

	thumbBytes, thumbContentType, err := encodeThumbnail(img, m.ContentType)
	if err != nil {
		return w.fail(ctx, m, err)
	}

	thumbKey := "thumbnails/" + m.ID
	if err := w.storage.Put(ctx, thumbKey, thumbContentType, bytes.NewReader(thumbBytes)); err != nil {
		return w.fail(ctx, m, err)
	}

	m.ThumbnailKey = thumbKey
	m.Status = StatusReady
	m.UpdatedAt = time.Now().UTC()
	if err := w.store.Update(ctx, m); err != nil {
		return err
	}
	w.logger.Info("thumbnail ready", "media_id", m.ID, "thumbnail_key", thumbKey)
	return nil
}

func (w *Worker) fail(ctx context.Context, m Media, cause error) error {
	m.Status = StatusFailed
	m.UpdatedAt = time.Now().UTC()
	if err := w.store.Update(ctx, m); err != nil {
		return err
	}
	return cause
}
