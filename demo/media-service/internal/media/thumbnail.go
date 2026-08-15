package media

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

// thumbnailMaxDim is the longest edge a thumbnail is scaled to. Pure
// policy, not a protocol requirement — chosen as a reasonable chat-bubble
// preview size, same spirit as the size cap and content-type allowlist in
// media.go.
const thumbnailMaxDim = 320

// decodeImage picks the decoder by the declared content type rather than
// sniffing the bytes — the type was already validated at upload time, and
// trusting it here keeps this function honest about what it does and
// doesn't check: it decodes pixels, it does not re-verify file identity.
func decodeImage(contentType string, r io.Reader) (image.Image, error) {
	switch contentType {
	case "image/jpeg":
		return jpeg.Decode(r)
	case "image/png":
		return png.Decode(r)
	case "image/gif":
		// Decode (not DecodeAll) returns just the first frame, which is all
		// a static thumbnail needs.
		return gif.Decode(r)
	case "image/webp":
		return webp.Decode(r)
	default:
		return nil, fmt.Errorf("media: no thumbnail decoder for %q", contentType)
	}
}

// thumbnailFormat decides the output encoding for a thumbnail. PNG for
// source formats that can carry transparency (PNG, GIF), so a transparent
// source doesn't silently grow a black/white matte; JPEG otherwise, since
// it's smaller and photos rarely need alpha. WebP thumbnails come out as
// JPEG too — x/image can decode WebP but Go has no maintained pure encoder
// for it, and re-deriving one is out of scope for a v1 thumbnailer.
func thumbnailFormat(sourceContentType string) string {
	switch sourceContentType {
	case "image/png", "image/gif":
		return "image/png"
	default:
		return "image/jpeg"
	}
}

// scaleDown resizes img so its longest edge is at most thumbnailMaxDim,
// preserving aspect ratio. Images already smaller than that are returned
// unchanged — a thumbnailer's job is to cap size, not to upscale and
// invent detail that isn't there.
func scaleDown(img image.Image) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= thumbnailMaxDim && h <= thumbnailMaxDim {
		return img
	}

	var newW, newH int
	if w >= h {
		newW = thumbnailMaxDim
		newH = h * thumbnailMaxDim / w
	} else {
		newH = thumbnailMaxDim
		newW = w * thumbnailMaxDim / h
	}
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	// CatmullRom: a high-quality bicubic-family interpolator, the standard
	// choice for downscaling photos without the block artifacts nearest-
	// neighbor or linear resampling leave behind.
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
	return dst
}

// encodeThumbnail scales and re-encodes img per the format decision in
// thumbnailFormat, returning the bytes and the content type they were
// encoded as.
func encodeThumbnail(img image.Image, sourceContentType string) ([]byte, string, error) {
	small := scaleDown(img)
	outType := thumbnailFormat(sourceContentType)

	var buf bytes.Buffer
	var err error
	switch outType {
	case "image/png":
		err = png.Encode(&buf, small)
	case "image/jpeg":
		err = jpeg.Encode(&buf, small, &jpeg.Options{Quality: 85})
	default:
		return nil, "", fmt.Errorf("media: unknown thumbnail output type %q", outType)
	}
	if err != nil {
		return nil, "", fmt.Errorf("media: encode thumbnail: %w", err)
	}
	return buf.Bytes(), outType, nil
}
