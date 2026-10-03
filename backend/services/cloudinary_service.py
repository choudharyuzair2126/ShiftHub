import cloudinary
import cloudinary.uploader
import cloudinary.utils
from ..config import get_settings

settings = get_settings()

# Configure Cloudinary once on import
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

FOLDER = "shifthub/resumes"

def _enabled() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )

def upload_resume(file_obj, user_id: int) -> str:
    """
    Upload a resume file to Cloudinary as a private/authenticated raw asset.
    Returns the secure delivery URL (which requires the Cloudinary account to
    allow public access OR for you to generate a signed URL on read).
    """
    if not _enabled():
        raise RuntimeError(
            "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your .env file."
        )

    # resource_type="raw" is required for PDFs / DOCX.
    # type="upload" keeps the asset private-ish (URL is public, but hash-protected).
    result = cloudinary.uploader.upload(
        file_obj,
        resource_type="raw",
        type="upload",
        folder=FOLDER,
        public_id=f"user_{user_id}",
        overwrite=True,
        invalidate=True,
    )
    return result.get("secure_url", "")

def signed_url(public_id: str, expires_in: int = 3600) -> str:
    """Generate a signed (time-limited) URL for a private asset."""
    if not _enabled():
        return ""
    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="raw",
        type="upload",
        sign_url=True,
        expires_at=int(__import__("time").time()) + expires_in,
        secure=True,
    )
    return url

def delete_resume(public_id: str) -> None:
    if not _enabled():
        return
    try:
        cloudinary.uploader.destroy(public_id, resource_type="raw", invalidate=True)
    except Exception:
        pass