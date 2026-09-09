import multer from "multer";
import { AppError } from "@common/errors/AppError";

// Handbook Sec 13 — server-side size/mime enforcement, never trusting the
// client to have enforced it. Memory storage: files are small (receipts
// <=10MB, resumes <=5MB) and are written to the StorageAdapter immediately
// after multer hands them off, so buffering in memory is fine at this scale.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

export function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? "";
}

function fileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile?: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(
      AppError.badRequest(
        "UNSUPPORTED_FILE_TYPE",
        "Only JPEG, PNG, and PDF files are accepted",
      ),
    );
    return;
  }
  callback(null, true);
}

// Sec 13 — receipts: 10MB/file, max 5 files/claim. Resumes: 5MB/file, one
// per candidate. Route-level `.single()`/`.array()` calls enforce the file
// count; these two instances only differ in per-file size.
export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter,
});

export const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});
