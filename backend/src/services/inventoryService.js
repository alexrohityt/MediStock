import Inventory from "../models/Inventory.js";

export async function consumeInventoryStock({ pharmacyId, medicineId, inventoryId, quantity, session }) {
  const now = new Date();
  if (inventoryId) {
    const batch = await Inventory.findOne({
      _id: inventoryId,
      pharmacyId,
      medicineId,
      quantity: { $gte: quantity },
      expiryDate: { $gt: now },
      availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] }
    }).session(session);
    if (!batch) throw Object.assign(new Error("The selected batch is expired or has insufficient stock"), { status: 409 });
    const result = await Inventory.updateOne(
      { _id: batch._id, quantity: { $gte: quantity }, expiryDate: { $gt: now }, availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] } },
      {
        $inc: { quantity: -quantity },
        $set: { availabilityStatus: batch.quantity === quantity ? "OUT_OF_STOCK" : "AVAILABLE", lastUpdated: now }
      },
      { session }
    );
    if (result.modifiedCount !== 1) throw Object.assign(new Error("Stock changed before fulfillment"), { status: 409 });
    return;
  }
  const batches = await Inventory.find({
    pharmacyId,
    medicineId,
    quantity: { $gt: 0 },
    expiryDate: { $gt: now },
    availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] }
  }).sort({ expiryDate: 1, _id: 1 }).session(session);

  const available = batches.reduce((total, batch) => total + batch.quantity, 0);
  if (available < quantity) {
    throw Object.assign(new Error("Enough unexpired stock is unavailable"), { status: 409 });
  }

  let remaining = quantity;
  for (const batch of batches) {
    if (remaining === 0) break;
    const take = Math.min(batch.quantity, remaining);
    const result = await Inventory.updateOne(
      { _id: batch._id, quantity: { $gte: take } },
      {
        $inc: { quantity: -take },
        $set: { availabilityStatus: batch.quantity === take ? "OUT_OF_STOCK" : "AVAILABLE", lastUpdated: now }
      },
      { session }
    );
    if (result.modifiedCount !== 1) {
      throw Object.assign(new Error("Stock changed before fulfillment"), { status: 409 });
    }
    remaining -= take;
  }
}
