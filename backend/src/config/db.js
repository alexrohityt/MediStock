import mongoose from "mongoose";
import { supportsTransactions } from "../services/mongoTransactions.js";

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
  if (!(await supportsTransactions())) {
    console.warn("MongoDB is standalone; multi-document transactions are unavailable. Stock workflows use atomic, idempotent operations where possible. Use MongoDB Atlas or a local replica set for full transactional guarantees.");
  }
}
