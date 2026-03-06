// ============================================================
// Seed Data — Server-side seed for PostgreSQL via Prisma
// Mirrors client-side Dexie seed for sync compatibility
// ============================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  // --- E-001: Users (3 roles) ---
  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      username: 'owner',
      displayName: 'Pemilik Restoran',
      role: 'owner',
      passwordHash,
      pinHash,
      isActive: true,
    },
  });

  const waiter = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {},
    create: {
      username: 'kasir',
      displayName: 'Budi Kasir',
      role: 'waiter-cashier',
      passwordHash,
      pinHash,
      isActive: true,
    },
  });

  const chef = await prisma.user.upsert({
    where: { username: 'chef' },
    update: {},
    create: {
      username: 'chef',
      displayName: 'Andi Chef',
      role: 'chef',
      passwordHash,
      pinHash,
      isActive: true,
    },
  });

  console.log('Seeded users:', owner.id, waiter.id, chef.id);

  // --- E-002: UserPermissions ---
  const waiterPerms = [
    { key: 'perm-view-stock', granted: false },
    { key: 'perm-view-menu', granted: true },
    { key: 'perm-view-recipe', granted: false },
    { key: 'perm-view-tables', granted: true },
    { key: 'perm-view-reports', granted: false },
    { key: 'perm-view-transactions', granted: false },
  ];
  const chefPerms = [
    { key: 'perm-chef-view-stock', granted: false },
    { key: 'perm-chef-view-menu', granted: true },
    { key: 'perm-chef-manage-recipe', granted: false },
  ];

  for (const p of waiterPerms) {
    await prisma.userPermission.upsert({
      where: { userId_permissionKey: { userId: waiter.id, permissionKey: p.key } },
      update: {},
      create: { userId: waiter.id, permissionKey: p.key, isGranted: p.granted },
    });
  }
  for (const p of chefPerms) {
    await prisma.userPermission.upsert({
      where: { userId_permissionKey: { userId: chef.id, permissionKey: p.key } },
      update: {},
      create: { userId: chef.id, permissionKey: p.key, isGranted: p.granted },
    });
  }
  console.log('Seeded user permissions');

  // --- E-018: PosSettings ---
  const existingSettings = await prisma.posSettings.findFirst();
  let settingsId: string;
  if (!existingSettings) {
    const settings = await prisma.posSettings.create({
      data: {
        ppnEnabled: true,
        ppnRate: 11,
        restaurantName: 'Restoran UMKM Logia',
        restaurantAddress: 'Jl. Merdeka No. 123, Jakarta',
        receiptFooter: 'Terima kasih atas kunjungan Anda!',
        showPpnOnReceipt: true,
      },
    });
    settingsId = settings.id;
    console.log('Seeded POS settings:', settingsId);
  } else {
    settingsId = existingSettings.id;
  }

  // --- E-019: EwalletProviders ---
  const providers = ['GoPay', 'OVO', 'Dana', 'ShopeePay'];
  const enabledProviders = ['GoPay', 'OVO'];
  for (const name of providers) {
    await prisma.ewalletProvider.upsert({
      where: { providerName: name },
      update: {},
      create: {
        posSettingsId: settingsId,
        providerName: name,
        isEnabled: enabledProviders.includes(name),
      },
    });
  }
  console.log('Seeded e-wallet providers');

  // --- E-010: Tables (10) ---
  for (let i = 1; i <= 10; i++) {
    await prisma.restaurantTable.upsert({
      where: { tableNumber: i },
      update: {},
      create: {
        tableName: `Meja ${i}`,
        tableNumber: i,
        capacity: i <= 6 ? 4 : 6,
        status: 'available',
      },
    });
  }
  console.log('Seeded 10 restaurant tables');

  // --- E-004: MenuCategories ---
  const catMakanan = await prisma.menuCategory.upsert({
    where: { name: 'Makanan' },
    update: {},
    create: { name: 'Makanan', sortOrder: 1 },
  });
  const catMinuman = await prisma.menuCategory.upsert({
    where: { name: 'Minuman' },
    update: {},
    create: { name: 'Minuman', sortOrder: 2 },
  });
  const catSnack = await prisma.menuCategory.upsert({
    where: { name: 'Snack' },
    update: {},
    create: { name: 'Snack', sortOrder: 3 },
  });
  console.log('Seeded 3 menu categories');

  // --- E-003: MenuItems ---
  const nasiGoreng = await prisma.menuItem.upsert({
    where: { itemName: 'Nasi Goreng Spesial' },
    update: {},
    create: { itemName: 'Nasi Goreng Spesial', price: 25000, categoryId: catMakanan.id, description: 'Nasi goreng dengan telur, ayam, dan sayuran', isAvailable: true },
  });
  const mieAyam = await prisma.menuItem.upsert({
    where: { itemName: 'Mie Ayam Bakso' },
    update: {},
    create: { itemName: 'Mie Ayam Bakso', price: 20000, categoryId: catMakanan.id, description: 'Mie ayam dengan bakso sapi', isAvailable: true },
  });
  const ayamBakar = await prisma.menuItem.upsert({
    where: { itemName: 'Ayam Bakar Madu' },
    update: {},
    create: { itemName: 'Ayam Bakar Madu', price: 35000, categoryId: catMakanan.id, description: 'Ayam bakar dengan saus madu', isAvailable: true },
  });
  await prisma.menuItem.upsert({
    where: { itemName: 'Es Jeruk Segar' },
    update: {},
    create: { itemName: 'Es Jeruk Segar', price: 8000, categoryId: catMinuman.id, description: 'Jeruk peras dengan es batu', isAvailable: true },
  });
  await prisma.menuItem.upsert({
    where: { itemName: 'Kopi Susu' },
    update: {},
    create: { itemName: 'Kopi Susu', price: 12000, categoryId: catMinuman.id, description: 'Kopi hitam dengan susu kental manis', isAvailable: true },
  });
  await prisma.menuItem.upsert({
    where: { itemName: 'Kerupuk Udang' },
    update: {},
    create: { itemName: 'Kerupuk Udang', price: 5000, categoryId: catSnack.id, description: 'Kerupuk udang renyah', isAvailable: true },
  });
  console.log('Seeded 6 menu items');

  // --- E-008: InventoryItems ---
  const inventoryData = [
    { itemName: 'Beras', quantity: 50, unit: 'kg', threshold: 10, status: 'ok' },
    { itemName: 'Ayam', quantity: 20, unit: 'kg', threshold: 5, status: 'ok' },
    { itemName: 'Mie Telur', quantity: 30, unit: 'pack', threshold: 10, status: 'ok' },
    { itemName: 'Telur', quantity: 100, unit: 'butir', threshold: 20, status: 'ok' },
    { itemName: 'Jeruk', quantity: 3, unit: 'kg', threshold: 5, status: 'low' },
    { itemName: 'Kopi Bubuk', quantity: 5, unit: 'kg', threshold: 2, status: 'ok' },
    { itemName: 'Susu Kental Manis', quantity: 15, unit: 'kaleng', threshold: 5, status: 'ok' },
    { itemName: 'Minyak Goreng', quantity: 0.5, unit: 'liter', threshold: 2, status: 'critical' },
  ];

  const inventoryIds: Record<string, string> = {};
  for (const item of inventoryData) {
    const inv = await prisma.inventoryItem.upsert({
      where: { itemName: item.itemName },
      update: {},
      create: {
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        minimumThreshold: item.threshold,
        stockStatus: item.status,
      },
    });
    inventoryIds[item.itemName] = inv.id;

    // E-009: Initial StockMovement
    const existing = await prisma.stockMovement.findFirst({
      where: { inventoryItemId: inv.id, reason: 'Stok awal' },
    });
    if (!existing) {
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: inv.id,
          movementType: 'restock',
          quantityChange: item.quantity,
          reason: 'Stok awal',
          performedBy: 'system',
        },
      });
    }
  }
  console.log('Seeded 8 inventory items with stock movements');

  // --- E-005: Recipes ---
  const recipeNasiGoreng = await prisma.recipe.upsert({
    where: { menuItemId: nasiGoreng.id },
    update: {},
    create: { menuItemId: nasiGoreng.id, cookingTime: 15, difficultyLevel: 'medium', notes: 'Goreng dengan api besar' },
  });
  const recipeMieAyam = await prisma.recipe.upsert({
    where: { menuItemId: mieAyam.id },
    update: {},
    create: { menuItemId: mieAyam.id, cookingTime: 10, difficultyLevel: 'easy', notes: 'Rebus mie hingga al dente' },
  });
  const recipeAyamBakar = await prisma.recipe.upsert({
    where: { menuItemId: ayamBakar.id },
    update: {},
    create: { menuItemId: ayamBakar.id, cookingTime: 25, difficultyLevel: 'hard', notes: 'Marinasi minimal 30 menit sebelum bakar' },
  });
  console.log('Seeded 3 recipes');

  // --- E-006: RecipeIngredients ---
  const ingredients = [
    { recipeId: recipeNasiGoreng.id, inv: 'Beras', qty: 0.2, unit: 'kg' },
    { recipeId: recipeNasiGoreng.id, inv: 'Telur', qty: 2, unit: 'butir' },
    { recipeId: recipeNasiGoreng.id, inv: 'Minyak Goreng', qty: 0.05, unit: 'liter' },
    { recipeId: recipeMieAyam.id, inv: 'Mie Telur', qty: 1, unit: 'pack' },
    { recipeId: recipeMieAyam.id, inv: 'Ayam', qty: 0.15, unit: 'kg' },
    { recipeId: recipeAyamBakar.id, inv: 'Ayam', qty: 0.3, unit: 'kg' },
    { recipeId: recipeAyamBakar.id, inv: 'Minyak Goreng', qty: 0.03, unit: 'liter' },
  ];

  for (const ing of ingredients) {
    const existing = await prisma.recipeIngredient.findFirst({
      where: { recipeId: ing.recipeId, inventoryItemId: inventoryIds[ing.inv] },
    });
    if (!existing) {
      await prisma.recipeIngredient.create({
        data: {
          recipeId: ing.recipeId,
          inventoryItemId: inventoryIds[ing.inv],
          quantityRequired: ing.qty,
          unit: ing.unit,
        },
      });
    }
  }
  console.log('Seeded 7 recipe ingredients');

  // --- E-007: RecipeSteps ---
  const steps = [
    { recipeId: recipeNasiGoreng.id, order: 1, text: 'Panaskan minyak goreng di wajan besar' },
    { recipeId: recipeNasiGoreng.id, order: 2, text: 'Goreng telur orak-arik, sisihkan' },
    { recipeId: recipeNasiGoreng.id, order: 3, text: 'Masukkan nasi, aduk rata dengan bumbu' },
    { recipeId: recipeNasiGoreng.id, order: 4, text: 'Tambahkan telur, aduk hingga merata' },
    { recipeId: recipeMieAyam.id, order: 1, text: 'Rebus mie dalam air mendidih 3 menit' },
    { recipeId: recipeMieAyam.id, order: 2, text: 'Tiriskan mie, campur dengan minyak wijen' },
    { recipeId: recipeMieAyam.id, order: 3, text: 'Sajikan dengan ayam suwir dan bakso' },
    { recipeId: recipeAyamBakar.id, order: 1, text: 'Marinasi ayam dengan bumbu madu minimal 30 menit' },
    { recipeId: recipeAyamBakar.id, order: 2, text: 'Panggang di atas arang hingga matang' },
    { recipeId: recipeAyamBakar.id, order: 3, text: 'Olesi saus madu, panggang 2 menit lagi' },
  ];

  for (const step of steps) {
    const existing = await prisma.recipeStep.findFirst({
      where: { recipeId: step.recipeId, stepOrder: step.order },
    });
    if (!existing) {
      await prisma.recipeStep.create({
        data: { recipeId: step.recipeId, stepOrder: step.order, instruction: step.text },
      });
    }
  }
  console.log('Seeded 10 recipe steps');

  // --- E-016: Discounts ---
  await prisma.discount.upsert({
    where: { discountName: 'Promo Weekday 10%' },
    update: {},
    create: { discountName: 'Promo Weekday 10%', discountType: 'percentage', discountValue: 10, appliedTo: 'whole_order', isActive: true },
  });
  await prisma.discount.upsert({
    where: { discountName: 'Diskon Member Rp 5.000' },
    update: {},
    create: { discountName: 'Diskon Member Rp 5.000', discountType: 'fixed_amount', discountValue: 5000, appliedTo: 'whole_order', isActive: true },
  });
  console.log('Seeded 2 discounts');

  console.log('\n=== Seed Complete ===');
  console.log('Users: owner/admin123, kasir/admin123, chef/admin123 (PIN: 123456)');
  console.log('Menu: 6 items, 3 categories, 3 recipes');
  console.log('Inventory: 8 items (1 low, 1 critical)');
  console.log('Tables: 10, Discounts: 2, E-wallets: 4');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
