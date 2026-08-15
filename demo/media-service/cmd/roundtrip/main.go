// roundtrip is a throwaway verification program, not part of the service.
// It proves the presigned-URL contract end to end using a plain net/http
// client on the "client" side — exactly what a browser would do — with no
// AWS SDK involved once the URLs are issued. Run it against a local MinIO
// (docker compose up) before trusting the Storage interface to build the
// HTTP API on top of.
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/rishavraj/media-service/internal/storage"
)

func main() {
	ctx := context.Background()

	s3, err := storage.NewS3Storage(ctx, storage.S3Config{
		Bucket:          "media-service-dev",
		Region:          "us-east-1",
		Endpoint:        "http://localhost:9000",
		AccessKeyID:     "mediaservice",
		SecretAccessKey: "mediaservice-dev-secret",
		UsePathStyle:    true,
	})
	if err != nil {
		log.Fatalf("new storage: %v", err)
	}

	if err := s3.EnsureBucket(ctx); err != nil {
		log.Fatalf("ensure bucket: %v", err)
	}

	key := fmt.Sprintf("roundtrip-test/%d.txt", time.Now().UnixNano())
	payload := []byte("media-service presigned upload round trip, " + time.Now().String())
	wantSum := sha256.Sum256(payload)

	// 1. Server issues a presigned PUT URL — no bytes touched yet.
	uploadURL, expiresAt, err := s3.PresignUpload(ctx, key, "text/plain", int64(len(payload)), 5*time.Minute)
	if err != nil {
		log.Fatalf("presign upload: %v", err)
	}
	fmt.Printf("presigned upload URL issued, expires %s\n", expiresAt.Format(time.RFC3339))

	// 2. "Client" PUTs directly to storage, bypassing this program's own
	// business logic entirely — the point of the whole pattern.
	putReq, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(payload))
	if err != nil {
		log.Fatalf("build put request: %v", err)
	}
	putReq.Header.Set("Content-Type", "text/plain")
	putReq.ContentLength = int64(len(payload))
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		log.Fatalf("presigned PUT: %v", err)
	}
	putResp.Body.Close()
	if putResp.StatusCode != http.StatusOK {
		log.Fatalf("presigned PUT: unexpected status %d", putResp.StatusCode)
	}
	fmt.Println("uploaded via presigned PUT")

	// 3. Server verifies the object actually landed before marking it ready.
	info, err := s3.Stat(ctx, key)
	if err != nil {
		log.Fatalf("stat: %v", err)
	}
	if info.Size != int64(len(payload)) {
		log.Fatalf("size mismatch: stat=%d payload=%d", info.Size, len(payload))
	}
	fmt.Printf("stat confirms object landed: %d bytes, content-type %q\n", info.Size, info.ContentType)

	// 4. Server issues a presigned GET URL for any authorized caller to read.
	downloadURL, err := s3.PresignDownload(ctx, key, 5*time.Minute)
	if err != nil {
		log.Fatalf("presign download: %v", err)
	}

	getResp, err := http.Get(downloadURL)
	if err != nil {
		log.Fatalf("presigned GET: %v", err)
	}
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		log.Fatalf("presigned GET: unexpected status %d", getResp.StatusCode)
	}
	got, err := io.ReadAll(getResp.Body)
	if err != nil {
		log.Fatalf("read download body: %v", err)
	}
	gotSum := sha256.Sum256(got)
	if gotSum != wantSum {
		log.Fatalf("checksum mismatch: got %x want %x", gotSum, wantSum)
	}
	fmt.Println("downloaded via presigned GET, checksum matches")

	// 5. Cleanup, proving Delete works too.
	if err := s3.Delete(ctx, key); err != nil {
		log.Fatalf("delete: %v", err)
	}
	if _, err := s3.Stat(ctx, key); err != storage.ErrNotFound {
		log.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
	fmt.Println("deleted, confirmed gone")

	fmt.Println("\nROUND TRIP OK")
}
