// Package api is the HTTP boundary. media-service is only ever called by
// trusted backend services (chat-demo's backend, and later others) — never
// directly by browsers — so owner_id arrives as a field the caller already
// verified, and the whole surface sits behind a shared service token rather
// than per-end-user auth. A real deployment would use mTLS or a service mesh
// for that trust boundary; a bearer token is the honest v1 stand-in, named
// as such rather than dressed up as more than it is.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/rishavraj/media-service/internal/media"
)

type Server struct {
	svc          *media.Service
	serviceToken string
	logger       *slog.Logger
}

func NewServer(svc *media.Service, serviceToken string, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{svc: svc, serviceToken: serviceToken, logger: logger}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("POST /media", s.handleCreateUpload)
	mux.HandleFunc("POST /media/{id}/complete", s.handleCompleteUpload)
	mux.HandleFunc("GET /media/{id}", s.handleGet)
	mux.HandleFunc("DELETE /media/{id}", s.handleDelete)

	return s.withServiceAuth(mux)
}

func (s *Server) withServiceAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		got := r.Header.Get("Authorization")
		if got != "Bearer "+s.serviceToken || s.serviceToken == "" {
			writeError(w, http.StatusUnauthorized, "missing or invalid service token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type createUploadRequest struct {
	OwnerID     string `json:"owner_id"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type createUploadResponse struct {
	ID        string    `json:"id"`
	UploadURL string    `json:"upload_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (s *Server) handleCreateUpload(w http.ResponseWriter, r *http.Request) {
	var req createUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	ticket, err := s.svc.CreateUpload(r.Context(), req.OwnerID, req.ContentType, req.SizeBytes)
	if err != nil {
		s.writeMediaError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createUploadResponse{
		ID:        ticket.Media.ID,
		UploadURL: ticket.UploadURL,
		ExpiresAt: ticket.ExpiresAt,
	})
}

type completeUploadRequest struct {
	OwnerID string `json:"owner_id"`
}

func (s *Server) handleCompleteUpload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req completeUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	m, err := s.svc.CompleteUpload(r.Context(), id, req.OwnerID)
	if err != nil {
		s.writeMediaError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, mediaView{
		ID:          m.ID,
		OwnerID:     m.OwnerID,
		Status:      string(m.Status),
		ContentType: m.ContentType,
		SizeBytes:   m.SizeBytes,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	})
}

type mediaView struct {
	ID           string    `json:"id"`
	OwnerID      string    `json:"owner_id"`
	Status       string    `json:"status"`
	ContentType  string    `json:"content_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	URL          string    `json:"url,omitempty"`
	ThumbnailURL string    `json:"thumbnail_url,omitempty"`
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	resolved, err := s.svc.Get(r.Context(), id)
	if err != nil {
		s.writeMediaError(w, err)
		return
	}

	m := resolved.Media
	writeJSON(w, http.StatusOK, mediaView{
		ID:           m.ID,
		OwnerID:      m.OwnerID,
		Status:       string(m.Status),
		ContentType:  m.ContentType,
		SizeBytes:    m.SizeBytes,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
		URL:          resolved.URL,
		ThumbnailURL: resolved.ThumbnailURL,
	})
}

type deleteRequest struct {
	OwnerID string `json:"owner_id"`
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req deleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := s.svc.Delete(r.Context(), id, req.OwnerID); err != nil {
		s.writeMediaError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) writeMediaError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, media.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, media.ErrForbidden):
		writeError(w, http.StatusForbidden, "not the owner")
	case errors.Is(err, media.ErrInvalidContent):
		writeError(w, http.StatusBadRequest, "content type not allowed")
	case errors.Is(err, media.ErrTooLarge):
		writeError(w, http.StatusBadRequest, "size exceeds max upload size")
	case errors.Is(err, media.ErrWrongState):
		writeError(w, http.StatusConflict, "not valid in the current state")
	case errors.Is(err, media.ErrUploadMissing):
		writeError(w, http.StatusConflict, "no object found at the expected storage location")
	case errors.Is(err, media.ErrSizeMismatch):
		writeError(w, http.StatusConflict, "uploaded object size does not match what was declared")
	default:
		s.logger.Error("unhandled media error", "error", err)
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
