// Package media is the domain layer: what a Media object is, what states it
// can be in, and the business rules around creating and finishing an upload.
// It depends on storage.Storage for bytes and a Store for records, but knows
// nothing about HTTP — that boundary lives in internal/api.
package media

import (
	"errors"
	"fmt"
	"sync/atomic"
	"time"
)

type Status string

const (
	StatusPending    Status = "pending"    // upload URL issued, bytes not confirmed yet
	StatusProcessing Status = "processing" // bytes landed, a derived asset (e.g. thumbnail) is being built
	StatusReady      Status = "ready"
	StatusFailed     Status = "failed"
)

// Media is one uploaded object and its lifecycle state. ThumbnailKey is
// unset until a later processing step (see internal/media/thumbnail.go, not
// built yet) fills it in for image content types.
type Media struct {
	ID           string
	OwnerID      string
	Status       Status
	ContentType  string
	SizeBytes    int64
	StorageKey   string
	ThumbnailKey string // "" if none
	CreatedAt    time.Time
	UpdatedAt    time.Time
	// ExpiresAt is set only while Status == StatusPending: an upload that
	// never completes by this time is an orphan, eligible for sweep-up.
	// Cleared once the upload completes.
	ExpiresAt time.Time
}

var (
	ErrNotFound       = errors.New("media: not found")
	ErrForbidden      = errors.New("media: caller does not own this object")
	ErrInvalidContent = errors.New("media: content type not allowed")
	ErrTooLarge       = errors.New("media: exceeds max upload size")
	ErrWrongState     = errors.New("media: operation not valid in the current state")
	ErrUploadMissing  = errors.New("media: no object was found at the expected storage location")
	ErrSizeMismatch   = errors.New("media: uploaded object size does not match the declared size")
)

// idCounter makes NewID collision-free for IDs minted within the same
// millisecond by this process, the same trick Wavelink's message ids use —
// sortable, and unique with no shared sequence or lock.
var idCounter uint64

func NewID() string {
	n := atomic.AddUint64(&idCounter, 1)
	return fmt.Sprintf("%d-%d", time.Now().UnixMilli(), n)
}

// maxUploadBytes and allowedContentTypes are deliberately simple v1 policy:
// a fixed size cap and a small allowlist, not a configurable policy engine.
// Real content-moderation/virus-scanning is out of scope for v1 (see README).
const maxUploadBytes int64 = 25 << 20 // 25 MiB

var allowedContentTypes = map[string]bool{
	"image/jpeg":         true,
	"image/png":          true,
	"image/gif":          true,
	"image/webp":         true,
	"application/pdf":    true,
	"text/plain":         true,
	"application/zip":    true,
	"application/msword": true,
}

func ValidateUploadRequest(contentType string, sizeBytes int64) error {
	if !allowedContentTypes[contentType] {
		return ErrInvalidContent
	}
	if sizeBytes <= 0 || sizeBytes > maxUploadBytes {
		return ErrTooLarge
	}
	return nil
}

func IsImage(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}
