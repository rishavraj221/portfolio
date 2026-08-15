package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// S3Config configures S3Storage. Endpoint is empty for real AWS S3;
// pointing it at MinIO (e.g. "http://localhost:9000") is what makes local
// dev need nothing but Docker.
type S3Config struct {
	Bucket          string
	Region          string
	Endpoint        string // "" for real AWS S3
	AccessKeyID     string
	SecretAccessKey string
	// UsePathStyle is required for MinIO (bucket.localhost doesn't resolve);
	// real S3 uses virtual-hosted style and leaves this false.
	UsePathStyle bool
}

type S3Storage struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

func NewS3Storage(ctx context.Context, cfg S3Config) (*S3Storage, error) {
	if cfg.Bucket == "" {
		return nil, errors.New("storage: bucket is required")
	}

	loadOpts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}
	if cfg.AccessKeyID != "" {
		loadOpts = append(loadOpts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := config.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("storage: load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = cfg.UsePathStyle
	})

	return &S3Storage{
		client:  client,
		presign: s3.NewPresignClient(client),
		bucket:  cfg.Bucket,
	}, nil
}

func (s *S3Storage) PresignUpload(ctx context.Context, key, contentType string, size int64, ttl time.Duration) (string, time.Time, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("storage: presign upload: %w", err)
	}
	return req.URL, time.Now().Add(ttl), nil
}

func (s *S3Storage) PresignDownload(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: presign download: %w", err)
	}
	return req.URL, nil
}

func (s *S3Storage) Stat(ctx context.Context, key string) (ObjectInfo, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFound(err) {
			return ObjectInfo{}, ErrNotFound
		}
		return ObjectInfo{}, fmt.Errorf("storage: stat %q: %w", key, err)
	}
	info := ObjectInfo{}
	if out.ContentLength != nil {
		info.Size = *out.ContentLength
	}
	if out.ContentType != nil {
		info.ContentType = *out.ContentType
	}
	return info, nil
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("storage: delete %q: %w", key, err)
	}
	return nil
}

func (s *S3Storage) Put(ctx context.Context, key, contentType string, body io.Reader) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("storage: put %q: %w", key, err)
	}
	return nil
}

// EnsureBucket creates the configured bucket if it doesn't exist yet. Real S3
// buckets are provisioned by infra/terraform, not application code — this
// exists purely so local dev against a fresh MinIO container needs no manual
// setup step.
func (s *S3Storage) EnsureBucket(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(s.bucket)})
	if err == nil {
		return nil
	}
	_, err = s.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(s.bucket)})
	if err != nil {
		return fmt.Errorf("storage: ensure bucket %q: %w", s.bucket, err)
	}
	return nil
}

func (s *S3Storage) Get(ctx context.Context, key string) (io.ReadCloser, ObjectInfo, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFound(err) {
			return nil, ObjectInfo{}, ErrNotFound
		}
		return nil, ObjectInfo{}, fmt.Errorf("storage: get %q: %w", key, err)
	}
	info := ObjectInfo{}
	if out.ContentLength != nil {
		info.Size = *out.ContentLength
	}
	if out.ContentType != nil {
		info.ContentType = *out.ContentType
	}
	return out.Body, info, nil
}

// isNotFound covers both the real S3 "NotFound"/"NoSuchKey" API errors and
// the generic 404 smithy-go falls back to when a backend (MinIO included)
// doesn't populate a modeled error code for HeadObject.
func isNotFound(err error) bool {
	var re *smithyhttp.ResponseError
	if errors.As(err, &re) {
		return re.HTTPStatusCode() == 404
	}
	return false
}

var _ Storage = (*S3Storage)(nil)
