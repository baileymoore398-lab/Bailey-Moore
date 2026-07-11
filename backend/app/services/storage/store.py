"""Object storage abstraction.

Uses S3 (or any S3-compatible endpoint such as MinIO) when credentials are
configured, and transparently falls back to local disk storage otherwise so the
platform runs with zero cloud configuration in development.
"""
from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class StorageBackend:
    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError

    def get(self, key: str) -> bytes:
        raise NotImplementedError

    def url(self, key: str) -> str:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError


class LocalStorage(StorageBackend):
    def __init__(self, root: str):
        self.root = Path(root)
        try:
            self.root.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            # The configured dir may be unwritable (e.g. a non-root container
            # user can't create ./storage_data in a root-owned workdir). Fall
            # back to a guaranteed-writable temp dir so uploads still work.
            import tempfile

            fallback = Path(tempfile.gettempdir()) / "routeforge_storage"
            fallback.mkdir(parents=True, exist_ok=True)
            logger.warning(
                "LOCAL_STORAGE_DIR %s not writable (%s); using %s",
                root, exc, fallback,
            )
            self.root = fallback

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        # Prevent path traversal outside the storage root.
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("Invalid storage key")
        return p

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def url(self, key: str) -> str:
        # Served by the API's /files route in local mode.
        return f"{settings.API_V1_PREFIX}/files/{key}"

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()


class S3Storage(StorageBackend):
    def __init__(self):
        import boto3

        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket)
            except Exception as exc:  # pragma: no cover
                logger.warning("Could not ensure S3 bucket %s: %s", self.bucket, exc)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        extra = {"ContentType": content_type} if content_type else {}
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)
        return key

    def get(self, key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].read()

    def url(self, key: str) -> str:
        if settings.S3_PUBLIC_URL:
            return f"{settings.S3_PUBLIC_URL.rstrip('/')}/{key}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=3600,
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


def _build_storage() -> StorageBackend:
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        try:
            return S3Storage()
        except Exception as exc:  # pragma: no cover
            logger.warning("S3 init failed (%s); using local storage.", exc)
    # On ephemeral hosts (Railway/Render) local disk is wiped on every redeploy,
    # so uploaded maps/GPX/videos would be LOST. Warn loudly in production.
    if settings.ENV == "production":
        logger.warning(
            "STORAGE FALLBACK: no S3 configured — using ephemeral local disk. "
            "Uploaded files WILL be lost on every redeploy/restart. Configure "
            "AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (+ S3_BUCKET) to persist data."
        )
    return LocalStorage(settings.LOCAL_STORAGE_DIR)


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        _storage = _build_storage()
    return _storage
