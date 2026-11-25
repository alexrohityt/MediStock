import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";

const allowedTypes = {
  "application/pdf": (buffer) => buffer.subarray(0, 5).toString() === "%PDF-",
  "image/jpeg": (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/png": (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
};

function getBucket() {
  if (!mongoose.connection.db) throw Object.assign(new Error("Prescription storage is unavailable"), { status: 503 });
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "privatePrescriptions" });
}

export async function savePrescription(file) {
  const isValid = allowedTypes[file.mimetype];
  if (!isValid || !isValid(file.buffer)) {
    throw Object.assign(new Error("Upload a valid PDF, JPEG, or PNG prescription"), { status: 422 });
  }
  const fileId = randomUUID();
  await pipeline(Readable.from([file.buffer]), getBucket().openUploadStream(fileId, {
    contentType: file.mimetype,
    metadata: { private: true }
  }));
  return { fileId, mimeType: file.mimetype, uploadedAt: new Date() };
}

export async function readPrescription(fileId) {
  if (!/^[\da-f-]{36}$/i.test(fileId)) {
    throw Object.assign(new Error("Prescription file not found"), { status: 404 });
  }
  const bucket = getBucket();
  const file = await bucket.find({ filename: fileId }).limit(1).next();
  if (!file) throw Object.assign(new Error("Prescription file not found"), { status: 404 });
  const chunks = [];
  for await (const chunk of bucket.openDownloadStream(file._id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function removePrescription(fileId) {
  if (!/^[\da-f-]{36}$/i.test(fileId || "")) return;
  const bucket = getBucket();
  const file = await bucket.find({ filename: fileId }).limit(1).next();
  if (file) await bucket.delete(file._id);
}
