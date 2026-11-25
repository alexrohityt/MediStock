import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Inventory from "../src/models/Inventory.js";

async function migrate() {
  await connectDB();
  const indexes = await Inventory.collection.indexes();
  const oldUniqueIndex = indexes.find((index) =>
    index.unique &&
    index.key.pharmacyId === 1 &&
    index.key.medicineId === 1 &&
    !index.key.batchNumber
  );
  if (oldUniqueIndex) {
    await Inventory.collection.dropIndex(oldUniqueIndex.name);
    console.log(`Removed legacy index: ${oldUniqueIndex.name}`);
  }
  const updatedIndexes = await Inventory.collection.indexes();
  const batchIndexExists = updatedIndexes.some((index) =>
    index.unique &&
    index.key.pharmacyId === 1 &&
    index.key.medicineId === 1 &&
    index.key.batchNumber === 1
  );
  if (!batchIndexExists) {
    await Inventory.collection.createIndex(
      { pharmacyId: 1, medicineId: 1, batchNumber: 1 },
      { unique: true }
    );
  }
  console.log("Inventory now supports multiple batches per medicine.");
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error("Inventory batch migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
