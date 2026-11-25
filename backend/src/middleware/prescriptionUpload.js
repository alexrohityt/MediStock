import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype)) {
      return callback(Object.assign(new Error("Upload a PDF, JPEG, or PNG prescription"), { status: 422 }));
    }
    callback(null, true);
  }
}).single("prescription");

export function uploadPrescription(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError ? 422 : error.status || 400;
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Prescription must be 5 MB or smaller"
      : error.message;
    res.status(status).json({ success: false, message });
  });
}