import mongoose from "mongoose";

let transactionSupport;

export async function supportsTransactions() {
  if (transactionSupport !== undefined) return transactionSupport;
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  transactionSupport = Boolean(hello.setName || hello.msg === "isdbgrid");
  return transactionSupport;
}
