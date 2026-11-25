  import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Pharmacy from "../src/models/Pharmacy.js";
import Medicine from "../src/models/Medicine.js";
import Inventory from "../src/models/Inventory.js";
import Request from "../src/models/Request.js";

async function seed() {
  await connectDB();

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required");
  }

  await Promise.all([Request.deleteMany({}), Inventory.deleteMany({}), Medicine.deleteMany({}), Pharmacy.deleteMany({}), User.deleteMany({})]);

  const admin = await User.create({
    name: process.env.ADMIN_NAME || "MediStock Administrator",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "ADMIN"
  });

  const customer = await User.create({ name: "Demo Customer", email: "customer@medistock.local", phone: "9000000001", password: "DemoCustomer123!", role: "CUSTOMER" });
  const pharmacyOwners = await User.create([
    { name: "Demo Pharmacy One Owner", email: "pharmacy1@medistock.local", phone: "9000000011", password: "DemoPharmacy123!", role: "PHARMACY" },
    { name: "Demo Pharmacy Two Owner", email: "pharmacy2@medistock.local", phone: "9000000012", password: "DemoPharmacy123!", role: "PHARMACY" }
  ]);

  const pharmacies = await Pharmacy.create([
    {
      ownerId: pharmacyOwners[0].id, pharmacyName: "Fictional GreenCare Pharmacy",
      address: "12 Demo Health Road", city: "Pune", state: "Maharashtra", pincode: "411001",
      location: { type: "Point", coordinates: [73.8567, 18.5204] }, phone: "9111111111",
      licenseNumber: "DEMO-MH-001", verificationStatus: "APPROVED", openingTime: "08:00", closingTime: "22:00"
    },
    {
      ownerId: pharmacyOwners[1].id, pharmacyName: "Fictional WellNest Pharmacy",
      address: "45 Sample Avenue", city: "Pune", state: "Maharashtra", pincode: "411038",
      location: { type: "Point", coordinates: [73.8785, 18.5089] }, phone: "9222222222",
      licenseNumber: "DEMO-MH-002", verificationStatus: "APPROVED", openingTime: "09:00", closingTime: "21:00"
    }
  ]);

  const medicineData = [
    ["Paracetamol", "Acetaminophen", "Crocin", "500 mg", "Tablet"],
    ["Cetirizine", "Cetirizine Hydrochloride", "Zyrtec", "10 mg", "Tablet"],
    ["Azithromycin", "Azithromycin", "Azithral", "500 mg", "Tablet"],
    ["Metformin", "Metformin Hydrochloride", "Glucophage", "500 mg", "Tablet"],
    ["Amoxicillin", "Amoxicillin", "Amoxyclav", "500 mg", "Capsule"],
    ["Pantoprazole", "Pantoprazole Sodium", "Pan 40", "40 mg", "Tablet"],
    ["Atorvastatin", "Atorvastatin", "Atorva", "10 mg", "Tablet"],
    ["Amlodipine", "Amlodipine Besilate", "Amlong", "5 mg", "Tablet"],
    ["Salbutamol", "Salbutamol", "Asthalin", "100 mcg", "Inhaler"],
    ["Diclofenac", "Diclofenac Sodium", "Voveran", "50 mg", "Tablet"],
    ["ORS Powder", "Oral Rehydration Salts", "Electral", "21 g", "Powder"],
    ["Vitamin C", "Ascorbic Acid", "Celin", "500 mg", "Tablet"],
    ["Ibuprofen", "Ibuprofen", "Brufen", "400 mg", "Tablet"],
    ["Omeprazole", "Omeprazole", "Omez", "20 mg", "Capsule"],
    ["Montelukast", "Montelukast Sodium", "Montair", "10 mg", "Tablet"],
    ["Calcium", "Calcium Carbonate", "Shelcal", "500 mg", "Tablet"]
  ];
  const medicines = await Medicine.create(medicineData.map(([medicineName, genericName, brandName, strength, dosageForm], index) => ({
    medicineName, genericName, brandName, strength, dosageForm,
    manufacturer: "Fictional Demo Manufacturer",
    description: "Demo catalogue record for project testing.",
    prescriptionRequired: index === 2 || index === 4
  })));

  const inventory = [];
  medicines.forEach((medicine, index) => {
    pharmacies.forEach((pharmacy, pharmacyIndex) => {
      if ((index + pharmacyIndex) % 3 !== 2) {
        inventory.push({
          pharmacyId: pharmacy.id,
          medicineId: medicine.id,
          quantity: 20 + ((index * 7 + pharmacyIndex * 11) % 80),
          price: 25 + ((index * 13 + pharmacyIndex * 9) % 250),
          batchNumber: `DEMO-${String(index + 1).padStart(2, "0")}-${pharmacyIndex + 1}`,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          availabilityStatus: "AVAILABLE",
          lastUpdated: new Date()
        });
      }
    });
  });
  await Inventory.create(inventory);

  await Request.create({
    customerId: customer.id,
    pharmacyId: pharmacies[0].id,
    medicineId: medicines[0].id,
    requestedQuantity: 2,
    status: "PENDING",
    remarks: "Demo request"
  });

  console.log("Seed complete. Demo-only accounts:");
  console.log(`Admin: ${admin.email}`);
  console.log("Customer: customer@medistock.local");
  console.log("Pharmacies: pharmacy1@medistock.local, pharmacy2@medistock.local");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
