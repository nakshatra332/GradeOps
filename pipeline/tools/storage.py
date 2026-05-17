"""
tools/storage.py — Storage backend abstraction.

Swap from local → S3 or GCS by implementing StorageBackend and changing
one line in config.py. No other code changes required.
"""

from __future__ import annotations
import abc
import os
import shutil
from pathlib import Path


class StorageBackend(abc.ABC):
    """Abstract base class for all storage backends."""

    @abc.abstractmethod
    def write(self, key: str, data: bytes) -> str:
        """
        Write binary data at the given key.
        Returns the canonical path/URL that can be used to retrieve the file.
        """

    @abc.abstractmethod
    def read(self, key: str) -> bytes:
        """Read and return the raw bytes stored at `key`."""

    @abc.abstractmethod
    def url(self, key: str) -> str:
        """Return a URL/path that the frontend or downstream tools can use."""


class LocalStorage(StorageBackend):
    """
    Writes files to the local filesystem under `root_dir`.
    Suitable for development and single-machine deployments.

    Swap to S3Storage or GCSStorage for production:
        storage = S3Storage(bucket="gradeops-exams")
    """

    def __init__(self, root_dir: str = "./scratch"):
        self.root = Path(root_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def _full_path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        # Safety: prevent path traversal outside root
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError(f"Unsafe storage key: {key!r}")
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    def write(self, key: str, data: bytes) -> str:
        path = self._full_path(key)
        path.write_bytes(data)
        return str(path)

    def read(self, key: str) -> bytes:
        return self._full_path(key).read_bytes()

    def url(self, key: str) -> str:
<<<<<<< HEAD
        return str(self._full_path(key))
=======
        """Return a URL-safe path relative to the project root for the frontend."""
        full_path = self._full_path(key)
        # Find project root (assumes storage.py is at pipeline/tools/storage.py)
        project_root = Path(__file__).resolve().parent.parent.parent
        try:
            # Return path relative to the root (e.g., /pipeline/scratch/...)
            return "/" + str(full_path.relative_to(project_root)).replace("\\", "/")
        except ValueError:
            # Fallback to string if for some reason it's not under project_root
            return str(full_path)
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


class S3Storage(StorageBackend):
    """
    AWS S3 backend. Requires boto3 and AWS credentials.
    Install: pip install boto3
    """

    def __init__(self, bucket: str, prefix: str = "gradeops/"):
        self.bucket = bucket
        self.prefix = prefix
        try:
            import boto3
            self._s3 = boto3.client("s3")
        except ImportError:
            raise ImportError("Install boto3 to use S3Storage: pip install boto3")

    def write(self, key: str, data: bytes) -> str:
        full_key = self.prefix + key
        self._s3.put_object(Bucket=self.bucket, Key=full_key, Body=data)
        return full_key

    def read(self, key: str) -> bytes:
        full_key = self.prefix + key
        resp = self._s3.get_object(Bucket=self.bucket, Key=full_key)
        return resp["Body"].read()

    def url(self, key: str) -> str:
        return f"s3://{self.bucket}/{self.prefix}{key}"


def get_storage() -> StorageBackend:
    """Factory — reads config and returns the appropriate backend."""
<<<<<<< HEAD
    from config import settings
=======
    from pipeline.config import settings
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    if settings.storage_backend == "s3":
        return S3Storage(bucket=settings.s3_bucket)
    # "gcs" support can be added here similarly
    return LocalStorage(root_dir=settings.local_storage_path)
