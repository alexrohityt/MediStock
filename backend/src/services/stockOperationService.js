import Inventory from "../models/Inventory.js";

export async function changeBatchStock({
  pharmacyId,
  inventoryId,
  medicineId,
  batchNumber,
  quantityChange,
  operationId,
  price,
  reorderLevel,
  expiryDate
}) {
  const filter = inventoryId
    ? { _id: inventoryId, pharmacyId }
    : { pharmacyId, medicineId, batchNumber };
  const existing = await Inventory.findOne(filter);

  if (existing) {
    const priorMovement = existing.stockMovements.find((movement) => movement.operationId === operationId);
    if (priorMovement) {
      if (priorMovement.quantityChange !== quantityChange) {
        throw Object.assign(new Error("This operation ID was already used with a different stock change"), { status: 409 });
      }
      return existing;
    }

    if (quantityChange < 0 && (
      existing.quantity < Math.abs(quantityChange) ||
      existing.expiryDate <= new Date() ||
      ["EXPIRED", "DISCONTINUED"].includes(existing.availabilityStatus)
    )) {
      throw Object.assign(new Error("The selected batch is expired or has insufficient stock"), { status: 409 });
    }
    if (expiryDate && existing.expiryDate.toISOString().slice(0, 10) !== new Date(expiryDate).toISOString().slice(0, 10)) {
      throw Object.assign(new Error("This batch number is already recorded with a different expiry date"), { status: 409 });
    }

    const result = await Inventory.updateOne(
      {
        _id: existing._id,
        ...(quantityChange < 0 ? { quantity: { $gte: Math.abs(quantityChange) }, expiryDate: { $gt: new Date() }, availabilityStatus: { $nin: ["EXPIRED", "DISCONTINUED"] } } : {}),
        "stockMovements.operationId": { $ne: operationId }
      },
      {
        $inc: { quantity: quantityChange },
        $push: { stockMovements: { operationId, quantityChange, createdAt: new Date() } },
        $set: {
          lastUpdated: new Date(),
          availabilityStatus: quantityChange < 0 && existing.quantity === Math.abs(quantityChange) ? "OUT_OF_STOCK" : "AVAILABLE",
          ...(price !== undefined ? { price } : {}),
          ...(reorderLevel !== undefined ? { reorderLevel } : {}),
          ...(expiryDate ? { expiryDate } : {})
        }
      }
    );
    if (result.modifiedCount === 1) return Inventory.findById(existing._id);
    const raced = await Inventory.findOne(filter);
    const racedMovement = raced?.stockMovements.find((movement) => movement.operationId === operationId);
    if (racedMovement?.quantityChange === quantityChange) return raced;
    throw Object.assign(new Error("Stock changed before this update could be applied"), { status: 409 });
  }

  if (quantityChange < 0) {
    throw Object.assign(new Error("The selected inventory batch was not found"), { status: 404 });
  }
  try {
    return await Inventory.create({
      pharmacyId,
      medicineId,
      batchNumber,
      quantity: quantityChange,
      reorderLevel: Math.max(0, Number(reorderLevel) || 10),
      price,
      expiryDate,
      availabilityStatus: "AVAILABLE",
      lastUpdated: new Date(),
      stockMovements: [{ operationId, quantityChange, createdAt: new Date() }]
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return changeBatchStock({ pharmacyId, medicineId, batchNumber, quantityChange, operationId, price, reorderLevel, expiryDate });
  }
}

export async function consumeInventoryStock({ pharmacyId, medicineId, inventoryId, quantity, operationId }) {
  if (inventoryId) {
    const batch = await Inventory.findOne({ _id: inventoryId, pharmacyId, medicineId });
    const priorMovement = batch?.stockMovements.find((movement) => movement.operationId === operationId);
    if (priorMovement) {
      if (priorMovement.quantityChange !== -quantity) {
        throw Object.assign(new Error("This operation ID was already used with a different stock change"), { status: 409 });
      }
      return;
    }
    await changeBatchStock({
      pharmacyId,
      inventoryId,
      medicineId,
      quantityChange: -quantity,
      operationId
    });
    return;
  }
  const previous = await Inventory.find({
    pharmacyId,
    medicineId,
    "stockMovements.operationId": operationId
  });
  let remaining = quantity - previous.reduce((total, batch) => {
    const movement = batch.stockMovements.find((item) => item.operationId === operationId);
    return total + Math.max(0, -(movement?.quantityChange || 0));
  }, 0);
  if (remaining <= 0) return;

  const batches = await Inventory.find({
    pharmacyId,
    medicineId,
    quantity: { $gt: 0 },
    expiryDate: { $gt: new Date() },
    availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] }
  }).sort({ expiryDate: 1, _id: 1 });

  try {
    for (const batch of batches) {
      if (remaining <= 0) break;
      const alreadyApplied = batch.stockMovements.some((movement) => movement.operationId === operationId);
      if (alreadyApplied) continue;
      const amount = Math.min(batch.quantity, remaining);
      await changeBatchStock({
        pharmacyId,
        inventoryId: batch._id,
        quantityChange: -amount,
        operationId
      });
      remaining -= amount;
    }
  } catch (error) {
    await rollbackStockOperation(operationId);
    throw error;
  }
  if (remaining > 0) {
    await rollbackStockOperation(operationId);
    throw Object.assign(new Error("Enough unexpired stock is unavailable"), { status: 409 });
  }
}

export async function rollbackStockOperation(operationId) {
  const batches = await Inventory.find({ "stockMovements.operationId": operationId });
  for (const batch of batches) {
    const movement = batch.stockMovements.find((item) => item.operationId === operationId);
    if (!movement) continue;
    await Inventory.updateOne(
      { _id: batch._id, "stockMovements.operationId": operationId },
      {
        $inc: { quantity: -movement.quantityChange },
        $pull: { stockMovements: { operationId } },
        $set: {
          availabilityStatus: batch.expiryDate <= new Date() ? "EXPIRED" : "AVAILABLE",
          lastUpdated: new Date()
        }
      }
    );
  }
}
