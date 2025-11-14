import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Seed admin user from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminName = process.env.ADMIN_NAME || "Admin";
  let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || "";
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || "";
  let generatedAdminPassword: string | undefined;

  if (!adminPasswordHash) {
    // If no plaintext is provided, generate a temporary strong password for local/dev
    const plain =
      adminPasswordPlain ||
      (() => {
        const bytes = Array.from({ length: 24 }, () =>
          Math.floor(Math.random() * 36)
        );
        const chars = bytes.map((n, i) => {
          const c = n.toString(36);
          // Mix in uppercase every few chars for complexity
          return i % 3 === 0 ? c.toUpperCase() : c;
        });
        return chars.join("");
      })();
    if (!adminPasswordPlain) {
      generatedAdminPassword = plain;
      console.warn(
        "ADMIN_PASSWORD not set. Generated a temporary admin password for local/dev seeding."
      );
    }
    // Hash the plaintext (provided or generated) password
    const bcrypt = require("bcryptjs");
    adminPasswordHash = await bcrypt.hash(plain, 10);
    console.log("Generated hash for admin password:", adminPasswordHash);
  }

  // Upsert admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      name: adminName,
      role: "admin",
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      name: adminName,
      role: "admin",
      isActive: true,
    },
  });
  console.log("Seeded admin user:", adminUser);
  if (generatedAdminPassword) {
    console.warn(
      "Temporary admin credentials (store securely and rotate soon):"
    );
    console.warn(`  Email:    ${adminEmail}`);
    console.warn(`  Password: ${generatedAdminPassword}`);
  }

  console.log("Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
