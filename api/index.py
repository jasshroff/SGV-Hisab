"""
Vercel serverless entry point for the FastAPI backend.
Vercel's Python runtime looks for an ASGI/WSGI 'app' in api/index.py.
We simply re-export the FastAPI app from the backend package.
"""
import sys
import os

# Make backend/ importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from server import app  # noqa: F401  # type: ignore[import]  – Vercel will pick up `app`
