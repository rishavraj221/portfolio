import { useEffect, useRef, useState } from "react";
import { getMedia } from "../lib/api";
import type { ResolvedMedia } from "../lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The signed URLs media-service hands back are short-lived (5 minutes, see
// demo/media-service's downloadURLTTL) — this component re-resolves a fresh
// one right before actually opening/downloading, rather than trusting
// whatever it fetched on mount is still valid by the time someone clicks.
export default function MediaAttachment({ userId, mediaId }: { userId: string; mediaId: string }) {
  const [media, setMedia] = useState<ResolvedMedia | null>(null);
  const [failed, setFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getMedia(userId, mediaId);
      if (cancelled) return;

      if (!result.ok) {
        setFailed(true);
        return;
      }
      setMedia(result.media);

      // Still generating a thumbnail — check back rather than leaving the
      // bubble stuck on a spinner forever. Non-images never land here:
      // they go straight to "ready" (see media-service's CompleteUpload).
      if (result.media.status === "processing") {
        pollRef.current = setTimeout(poll, 2000);
      } else if (result.media.status === "failed") {
        setFailed(true);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [userId, mediaId]);

  async function openFresh() {
    const result = await getMedia(userId, mediaId);
    if (result.ok && result.media.url) {
      window.open(result.media.url, "_blank", "noopener,noreferrer");
    }
  }

  if (failed) return <div className="attachment attachment-error">Attachment unavailable</div>;
  if (!media) return <div className="attachment attachment-loading">Loading attachment…</div>;

  const isImage = media.content_type.startsWith("image/");

  if (isImage) {
    const previewSrc = media.thumbnail_url ?? media.url;
    return (
      <button type="button" className="attachment attachment-image" onClick={openFresh}>
        {previewSrc ? <img src={previewSrc} alt="attachment" /> : <span className="muted">Processing…</span>}
      </button>
    );
  }

  return (
    <button type="button" className="attachment attachment-file" onClick={openFresh}>
      <span className="attachment-file-icon">📄</span>
      <span className="attachment-file-meta">
        <span className="attachment-file-type">{media.content_type}</span>
        <span className="attachment-file-size">{formatSize(media.size_bytes)}</span>
      </span>
    </button>
  );
}
