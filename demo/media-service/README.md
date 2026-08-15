# media-service

A standalone media/file storage service, independent of `chat-demo` on
purpose — it knows about owners and media objects, not conversations, so any
app (chat-demo today, something else later) can be a client.

Written in Go, not Elixir like `chat-demo`: this workload (presigned uploads,
image-processing workers) is a different job than Wavelink's connection
fanout, and it's picked on its own merits rather than inherited from the
first app that needed it.

## Status

Step 3 of the build: thumbnail generation. Image uploads that reach
`complete` land in `processing`, get picked up by an in-process worker pool
(`internal/media.Worker`), get decoded/resized/re-encoded, and flip to
`ready` with a `thumbnail_key` set — or `failed` if the bytes weren't a
decodable image. Verified end to end against a running server + MinIO with
real JPEG/PNG files (800x600 → 320x240, aspect ratio preserved) and with
deliberately corrupt bytes (correctly lands in `failed`, not stuck).

The worker is in-process, not a separate queue service — the honest v1 shape
for one node, same spirit as chat-demo's local PubSub. `Service.CompleteUpload`
enqueues a job but never blocks on it; a periodic sweep of `Store.ListByStatus`
re-enqueues anything still `processing`, so a dropped enqueue or a crash
mid-job both self-heal without manual intervention.

## Local dev

```
docker compose up -d                        # starts MinIO on :9000 (API) / :9001 (console)
go run ./cmd/roundtrip                       # proves the raw storage layer works
SERVICE_TOKEN=dev go run ./cmd/server        # starts the HTTP API on :8081
```

Every request except `GET /healthz` requires `Authorization: Bearer <SERVICE_TOKEN>`
— this API is meant to be called by a trusted backend (chat-demo's server),
never directly by a browser. `owner_id` is a field the caller declares,
trusted because the caller already authenticated the real user.

Example lifecycle:

```
curl -X POST localhost:8081/media -H "Authorization: Bearer dev" \
  -d '{"owner_id":"user-42","content_type":"text/plain","size_bytes":13}'
# -> {"id": "...", "upload_url": "...", "expires_at": "..."}

curl -X PUT "<upload_url>" -H "Content-Type: text/plain" --data-binary @file.txt

curl -X POST localhost:8081/media/<id>/complete -H "Authorization: Bearer dev" \
  -d '{"owner_id":"user-42"}'
# -> status: ready (or processing, for image/*); 403 if owner_id doesn't match

curl localhost:8081/media/<id> -H "Authorization: Bearer dev"
# -> includes a short-lived signed "url" to fetch the bytes back
```

MinIO speaks the real S3 API, so `internal/storage.S3Storage` is the only
storage implementation — dev points it at MinIO, prod points the same code
at AWS S3, via `S3Config.Endpoint`. No separate "local" backend to keep in
sync with the real one.

## Layout

```
cmd/roundtrip/       throwaway verification program, not part of the service
cmd/server/           HTTP server entrypoint
internal/storage/    Storage interface + S3-compatible implementation
internal/media/      Media domain type, Store, business logic, thumbnail worker
internal/api/         HTTP handlers, request/response types, service-token auth
```
