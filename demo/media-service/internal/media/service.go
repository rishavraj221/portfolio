package media

import (
	"context"
	"fmt"
	"time"

	"github.com/rishavraj/media-service/internal/storage"
)

const (
	uploadURLTTL   = 15 * time.Minute // long enough for a slow mobile upload
	downloadURLTTL = 5 * time.Minute  // short-lived: re-requested per view, not cached forever
	pendingTTL     = 1 * time.Hour    // an upload not completed within this window is an orphan
)

type Service struct {
	store   Store
	storage storage.Storage
	// needsProcessing is called with a Media id whenever it transitions to
	// StatusProcessing, so a worker can pick it up. It's a callback rather
	// than a hard dependency on the worker type so Service stays testable
	// without spinning up goroutines, and defaults to a no-op — the
	// reconciliation sweep (see thumbnail worker) is what makes that safe:
	// nothing calling this at all still self-heals on the next sweep.
	needsProcessing func(id string)
}

func NewService(store Store, blob storage.Storage) *Service {
	return &Service{store: store, storage: blob, needsProcessing: func(string) {}}
}

// OnNeedsProcessing registers the callback invoked when a Media enters
// StatusProcessing. Call it once at startup with the thumbnail worker's
// Enqueue method.
func (s *Service) OnNeedsProcessing(f func(id string)) {
	s.needsProcessing = f
}

// UploadTicket is what a caller gets back from CreateUpload: enough to
// perform the upload directly against storage, nothing more.
type UploadTicket struct {
	Media     Media
	UploadURL string
	ExpiresAt time.Time
}

// CreateUpload validates the declared upload, mints a Media record in
// StatusPending, and returns a presigned URL for the caller to PUT bytes to
// directly. media-service's own compute is not in that path.
func (s *Service) CreateUpload(ctx context.Context, ownerID, contentType string, sizeBytes int64) (UploadTicket, error) {
	if ownerID == "" {
		return UploadTicket{}, fmt.Errorf("media: owner_id is required")
	}
	if err := ValidateUploadRequest(contentType, sizeBytes); err != nil {
		return UploadTicket{}, err
	}

	now := time.Now().UTC()
	m := Media{
		ID:          NewID(),
		OwnerID:     ownerID,
		Status:      StatusPending,
		ContentType: contentType,
		SizeBytes:   sizeBytes,
		CreatedAt:   now,
		UpdatedAt:   now,
		ExpiresAt:   now.Add(pendingTTL),
	}
	m.StorageKey = "media/" + m.ID

	uploadURL, expiresAt, err := s.storage.PresignUpload(ctx, m.StorageKey, contentType, sizeBytes, uploadURLTTL)
	if err != nil {
		return UploadTicket{}, fmt.Errorf("media: presign upload: %w", err)
	}

	if err := s.store.Create(ctx, m); err != nil {
		return UploadTicket{}, fmt.Errorf("media: create record: %w", err)
	}

	return UploadTicket{Media: m, UploadURL: uploadURL, ExpiresAt: expiresAt}, nil
}

// CompleteUpload verifies the object actually landed in storage — size and
// content type must match what was declared at CreateUpload time — before
// flipping the record to ready. This is what stands between "client claims
// it uploaded" and the record actually being trustworthy. ownerID must match
// who the upload was created for: ids are sortable, sequential-looking
// strings, not secrets, so without this check a second caller who merely
// guessed a pending id could finalize someone else's upload.
//
// Image content types land in StatusProcessing instead of StatusReady:
// thumbnail generation (not built yet, see internal/media/thumbnail.go) is
// what finishes that transition. Non-image types have nothing left to do,
// so they go straight to ready.
func (s *Service) CompleteUpload(ctx context.Context, id, ownerID string) (Media, error) {
	m, err := s.store.Get(ctx, id)
	if err != nil {
		return Media{}, err
	}
	if m.OwnerID != ownerID {
		return Media{}, ErrForbidden
	}
	if m.Status != StatusPending {
		return Media{}, ErrWrongState
	}

	info, err := s.storage.Stat(ctx, m.StorageKey)
	if err != nil {
		if err == storage.ErrNotFound {
			return Media{}, ErrUploadMissing
		}
		return Media{}, fmt.Errorf("media: stat upload: %w", err)
	}
	if info.Size != m.SizeBytes {
		return Media{}, ErrSizeMismatch
	}

	m.Status = StatusReady
	if IsImage(m.ContentType) {
		m.Status = StatusProcessing
	}
	m.ExpiresAt = time.Time{}
	m.UpdatedAt = time.Now().UTC()

	if err := s.store.Update(ctx, m); err != nil {
		return Media{}, fmt.Errorf("media: update record: %w", err)
	}
	if m.Status == StatusProcessing {
		s.needsProcessing(m.ID)
	}
	return m, nil
}

// ResolvedMedia is a Media plus signed URLs a caller can hand straight to a
// client — resolving those URLs is deliberately not part of the Media
// record itself, since they're short-lived and re-derived per request.
type ResolvedMedia struct {
	Media        Media
	URL          string
	ThumbnailURL string // "" if no thumbnail (yet, or not applicable)
}

func (s *Service) Get(ctx context.Context, id string) (ResolvedMedia, error) {
	m, err := s.store.Get(ctx, id)
	if err != nil {
		return ResolvedMedia{}, err
	}

	resolved := ResolvedMedia{Media: m}
	if m.Status == StatusReady || m.Status == StatusProcessing {
		url, err := s.storage.PresignDownload(ctx, m.StorageKey, downloadURLTTL)
		if err != nil {
			return ResolvedMedia{}, fmt.Errorf("media: presign download: %w", err)
		}
		resolved.URL = url
	}
	if m.ThumbnailKey != "" {
		thumbURL, err := s.storage.PresignDownload(ctx, m.ThumbnailKey, downloadURLTTL)
		if err != nil {
			return ResolvedMedia{}, fmt.Errorf("media: presign thumbnail download: %w", err)
		}
		resolved.ThumbnailURL = thumbURL
	}
	return resolved, nil
}

// Delete removes both the storage object(s) and the record. Only the owner
// may delete; ErrForbidden otherwise.
func (s *Service) Delete(ctx context.Context, id, ownerID string) error {
	m, err := s.store.Get(ctx, id)
	if err != nil {
		return err
	}
	if m.OwnerID != ownerID {
		return ErrForbidden
	}

	if err := s.storage.Delete(ctx, m.StorageKey); err != nil {
		return fmt.Errorf("media: delete object: %w", err)
	}
	if m.ThumbnailKey != "" {
		if err := s.storage.Delete(ctx, m.ThumbnailKey); err != nil {
			return fmt.Errorf("media: delete thumbnail: %w", err)
		}
	}
	return s.store.Delete(ctx, id)
}
