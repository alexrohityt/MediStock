import Pharmacy from "../models/Pharmacy.js";

export function getPharmacyForUser(user, session) {
  const query = user.role === "STAFF"
    ? Pharmacy.findById(user.pharmacyId)
    : Pharmacy.findOne({ ownerId: user._id });
  return session ? query.session(session) : query;
}
