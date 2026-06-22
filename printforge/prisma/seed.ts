import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PrintForge NZ…");

  // --- Materials (drive the quote engine) ---
  const materials = [
    { code: "PLA", name: "PLA", densityGCm3: 1.24, pricePerKgNzd: 35, speedFactor: 1.1, strengthRating: 2, colours: ["Black", "White", "Grey", "Red", "Blue", "Green", "Orange"], description: "Easy to print, great for prototypes and display models." },
    { code: "PETG", name: "PETG", densityGCm3: 1.27, pricePerKgNzd: 42, speedFactor: 1.0, strengthRating: 4, colours: ["Black", "White", "Clear", "Grey", "Red"], description: "Strong and weather resistant — a great functional all-rounder." },
    { code: "TPU", name: "TPU (Flexible)", densityGCm3: 1.21, pricePerKgNzd: 60, speedFactor: 0.5, strengthRating: 3, colours: ["Black", "White", "Red"], description: "Flexible rubber-like material for grips, gaskets and bumpers." },
    { code: "ABS", name: "ABS", densityGCm3: 1.04, pricePerKgNzd: 40, speedFactor: 0.95, strengthRating: 4, colours: ["Black", "White", "Grey"], description: "Heat resistant and tough — printed in an enclosure." },
    { code: "ASA", name: "ASA", densityGCm3: 1.07, pricePerKgNzd: 48, speedFactor: 0.95, strengthRating: 4, colours: ["Black", "White", "Grey"], description: "UV and weather resistant — best for outdoor parts." },
    { code: "NYLON", name: "Nylon (PA)", densityGCm3: 1.14, pricePerKgNzd: 75, speedFactor: 0.85, strengthRating: 5, colours: ["Natural", "Black"], description: "Industrial strength and wear resistance." },
    { code: "CF_NYLON", name: "Carbon Fibre Nylon", densityGCm3: 1.18, pricePerKgNzd: 120, speedFactor: 0.8, strengthRating: 5, colours: ["Black"], description: "Premium stiffness-to-weight for demanding load-bearing parts." }
  ];
  const materialByCode: Record<string, string> = {};
  for (const m of materials) {
    const rec = await prisma.material.upsert({
      where: { code: m.code },
      update: m,
      create: m
    });
    materialByCode[m.code] = rec.id;
  }

  // --- Categories ---
  const categories = [
    { slug: "mountain-bike", name: "Mountain Bike", description: "GoPro mounts, Garmin mounts, tool holders, mudguards, bottle cages." },
    { slug: "automotive", name: "Automotive", description: "Brackets, clips, mounts and interior components." },
    { slug: "home", name: "Home", description: "Hooks, organisers and storage solutions." },
    { slug: "business", name: "Business", description: "Prototypes, manufacturing jigs and fixtures." },
    { slug: "education", name: "Education", description: "School projects, STEM models and engineering prototypes." }
  ];
  const catBySlug: Record<string, string> = {};
  for (const c of categories) {
    const rec = await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c
    });
    catBySlug[c.slug] = rec.id;
  }

  // --- Products ---
  const products = [
    { slug: "gopro-bar-mount", name: "GoPro Handlebar Mount", priceNzd: 18.5, categoryId: catBySlug["mountain-bike"], materialId: materialByCode["PETG"], featured: true, description: "Secure GoPro mount for 22–35mm handlebars. PETG for weather resistance.", ratingAvg: 4.8, ratingCount: 24 },
    { slug: "garmin-out-front-mount", name: "Garmin Out-Front Mount", priceNzd: 22, categoryId: catBySlug["mountain-bike"], materialId: materialByCode["CF_NYLON"], featured: true, description: "Lightweight stiff out-front mount for Garmin Edge computers.", ratingAvg: 4.9, ratingCount: 41 },
    { slug: "trail-bottle-cage", name: "Trail Bottle Cage", priceNzd: 16, categoryId: catBySlug["mountain-bike"], materialId: materialByCode["PETG"], description: "Vibration-tuned bottle cage that holds bottles on the roughest trails.", ratingAvg: 4.6, ratingCount: 12 },
    { slug: "multi-tool-holder", name: "Frame Tool Holder", priceNzd: 14, categoryId: catBySlug["mountain-bike"], materialId: materialByCode["TPU"], description: "Strap-on multitool holder with TPU grip.", ratingAvg: 4.4, ratingCount: 8 },
    { slug: "dash-phone-bracket", name: "Dash Phone Bracket", priceNzd: 24, categoryId: catBySlug["automotive"], materialId: materialByCode["ASA"], featured: true, description: "UV-stable dashboard phone bracket — won't warp in a hot car.", ratingAvg: 4.7, ratingCount: 19 },
    { slug: "wiring-clip-set", name: "Wiring Clip Set (x10)", priceNzd: 12, categoryId: catBySlug["automotive"], materialId: materialByCode["ABS"], description: "Heat-resistant engine-bay wiring clips.", ratingAvg: 4.5, ratingCount: 6 },
    { slug: "wall-hook-trio", name: "Heavy-Duty Wall Hooks (x3)", priceNzd: 15, categoryId: catBySlug["home"], materialId: materialByCode["PETG"], description: "Load-tested wall hooks for garage and shed.", ratingAvg: 4.6, ratingCount: 15 },
    { slug: "desk-cable-organiser", name: "Desk Cable Organiser", priceNzd: 11, categoryId: catBySlug["home"], materialId: materialByCode["PLA"], description: "Keep your desk tidy with this modular cable organiser.", ratingAvg: 4.3, ratingCount: 9 },
    { slug: "assembly-jig", name: "Custom Assembly Jig", priceNzd: 0, type: "SERVICE" as const, categoryId: catBySlug["business"], description: "Bespoke manufacturing jigs and fixtures — request a quote.", ratingAvg: 5.0, ratingCount: 4 },
    { slug: "stem-gear-set", name: "STEM Planetary Gear Set (STL)", priceNzd: 6, type: "DIGITAL_STL" as const, categoryId: catBySlug["education"], description: "Downloadable STL for a working planetary gear demo.", ratingAvg: 4.8, ratingCount: 31 }
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p
    });
  }

  // --- Printers ---
  const printers = [
    { name: "Bambu X1C #1", brand: "BAMBU_LAB" as const, model: "X1 Carbon", status: "PRINTING" as const, buildX: 256, buildY: 256, buildZ: 256, filamentRemainingG: 640, successRate: 0.98, loadedMaterialId: materialByCode["PETG"] },
    { name: "Bambu P1S #1", brand: "BAMBU_LAB" as const, model: "P1S", status: "IDLE" as const, filamentRemainingG: 980, successRate: 0.96, loadedMaterialId: materialByCode["PLA"] },
    { name: "Prusa MK4 #1", brand: "PRUSA" as const, model: "MK4", status: "IDLE" as const, buildX: 250, buildY: 210, buildZ: 220, filamentRemainingG: 410, successRate: 0.97, loadedMaterialId: materialByCode["ASA"] },
    { name: "Voron 2.4 #1", brand: "VORON" as const, model: "2.4 R2", status: "MAINTENANCE" as const, buildX: 350, buildY: 350, buildZ: 350, filamentRemainingG: 120, successRate: 0.94, loadedMaterialId: materialByCode["CF_NYLON"] },
    { name: "Creality K1 #1", brand: "CREALITY" as const, model: "K1 Max", status: "IDLE" as const, buildX: 300, buildY: 300, buildZ: 300, filamentRemainingG: 720, successRate: 0.92, loadedMaterialId: materialByCode["ABS"] }
  ];
  for (const p of printers) {
    const existing = await prisma.printer.findFirst({ where: { name: p.name } });
    if (existing) await prisma.printer.update({ where: { id: existing.id }, data: p });
    else await prisma.printer.create({ data: p });
  }

  // --- Users ---
  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@printforge.nz" },
    update: { role: "ADMIN", passwordHash: adminPass },
    create: { email: "admin@printforge.nz", name: "PrintForge Admin", role: "ADMIN", passwordHash: adminPass, referralCode: "ADMIN" }
  });
  const custPass = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "demo@printforge.nz" },
    update: { passwordHash: custPass },
    create: { email: "demo@printforge.nz", name: "Demo Customer", passwordHash: custPass, loyaltyPoints: 120, referralCode: "DEMO123" }
  });

  // --- Discount code ---
  await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENT", value: 10, active: true }
  });

  console.log("Seed complete.");
  console.log("  Admin:    admin@printforge.nz / admin123");
  console.log("  Customer: demo@printforge.nz / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
