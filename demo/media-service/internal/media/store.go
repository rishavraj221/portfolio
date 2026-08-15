package media

import (
	"context"
	"sync"
)

// Store persists Media records. Like Wavelink's Store/Directory behaviours,
// this is a boundary with one implementation today (MemoryStore, for dev and
// tests) and a real database implementation to follow later — a config
// value, not a branch through the business logic.
type Store interface {
	Create(ctx context.Context, m Media) error
	Get(ctx context.Context, id string) (Media, error)
	Update(ctx context.Context, m Media) error
	Delete(ctx context.Context, id string) error
	// ListByStatus returns every record in the given status. Used by the
	// thumbnail worker's reconciliation sweep to find processing records an
	// enqueue attempt may have dropped (channel full) or that were
	// in-flight when the process last restarted.
	ListByStatus(ctx context.Context, status Status) ([]Media, error)
}

// MemoryStore is a process-local, mutex-guarded map. Fine for dev and tests,
// explicitly not a claim about production concurrency or durability — the
// same honesty Wavelink.Store.Memory's moduledoc states about itself.
type MemoryStore struct {
	mu   sync.RWMutex
	byID map[string]Media
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{byID: make(map[string]Media)}
}

func (s *MemoryStore) Create(_ context.Context, m Media) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.byID[m.ID]; exists {
		return ErrWrongState
	}
	s.byID[m.ID] = m
	return nil
}

func (s *MemoryStore) Get(_ context.Context, id string) (Media, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, ok := s.byID[id]
	if !ok {
		return Media{}, ErrNotFound
	}
	return m, nil
}

func (s *MemoryStore) Update(_ context.Context, m Media) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.byID[m.ID]; !exists {
		return ErrNotFound
	}
	s.byID[m.ID] = m
	return nil
}

func (s *MemoryStore) ListByStatus(_ context.Context, status Status) ([]Media, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Media
	for _, m := range s.byID {
		if m.Status == status {
			out = append(out, m)
		}
	}
	return out, nil
}

func (s *MemoryStore) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.byID[id]; !exists {
		return ErrNotFound
	}
	delete(s.byID, id)
	return nil
}

var _ Store = (*MemoryStore)(nil)
