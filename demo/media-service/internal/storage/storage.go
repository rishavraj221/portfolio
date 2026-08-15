// Package storage abstracts the object-storage backend media-service uploads
// and serves files through. There is deliberately one implementation, not a
// local/prod pair: MinIO speaks the real S3 API, so the same S3Storage client
// runs against MinIO in dev and against AWS S3 in prod, picked by which
// endpoint/credentials it's configured with — the same "one code path, picked
// by config" boundary Wavelink's Store/Directory behaviours use, just drawn
// one layer lower because the protocol itself is already portable here.
package storage

import (
	"context"
	"io"
	"time"
)

// ObjectInfo describes a stored object's metadata, as reported by the backend.
type ObjectInfo struct {
	Size        int64
	ContentType string
}

// Storage is the boundary media-service's business logic depends on. It never
// sees raw bytes for uploads/downloads — those flow directly between the
// client and the backend via presigned URLs — except in tests, where a caller
// may use Put/Get to seed or inspect state without going through HTTP.
type Storage interface {
	// PresignUpload returns a URL the client can PUT the object's bytes to
	// directly, plus when that URL stops working.
	PresignUpload(ctx context.Context, key, contentType string, size int64, ttl time.Duration) (url string, expiresAt time.Time, err error)

	// PresignDownload returns a short-lived URL the client can GET the
	// object's bytes from directly.
	PresignDownload(ctx context.Context, key string, ttl time.Duration) (url string, err error)

	// Stat reports whether an object exists and its metadata, used to verify
	// an upload actually landed before a Media record is marked ready.
	Stat(ctx context.Context, key string) (ObjectInfo, error)

	// Delete removes an object. Deleting a key that doesn't exist is not an
	// error — callers use this for cleanup of state that may already be gone.
	Delete(ctx context.Context, key string) error

	// Put and Get are direct, non-presigned access, used by the orphan-sweep
	// job's tests and local tooling — not by the upload/download request path.
	Put(ctx context.Context, key, contentType string, body io.Reader) error
	Get(ctx context.Context, key string) (io.ReadCloser, ObjectInfo, error)
}

// ErrNotFound is returned by Stat/Get/Delete-adjacent calls when a key has no
// corresponding object.
var ErrNotFound = notFoundError{}

type notFoundError struct{}

func (notFoundError) Error() string { return "storage: object not found" }
