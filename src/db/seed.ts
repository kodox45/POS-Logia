// ============================================================
// Client-side seed data — Loaded into Dexie on first app launch
// Covers all 19 entity types with test data for all 3 roles
// ============================================================

import bcrypt from 'bcryptjs';
import { db } from './database';

function id(): string {
  return crypto.randomUUID();
}

export async function seedClientDatabase(): Promise<void> {
  // Check if already seeded
  const existingUsers = await db.users.count();
  if (existingUsers > 0) return;

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('admin123', 10);
  const pinHash = bcrypt.hashSync('123456', 10);

  // -------------------------------------------------------
  // E-001: Users — 3 roles
  // -------------------------------------------------------
  const ownerId = id();
  const waiterId = id();
  const chefId = id();

  await db.users.bulkAdd([
    {
      id: ownerId,
      username: 'owner',
      displayName: 'Pemilik Restoran',
      role: 'owner',
      passwordHash,
      pinHash,
      isActive: true,
      syncId: id(),
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: waiterId,
      username: 'kasir',
      displayName: 'Budi Kasir',
      role: 'waiter-cashier',
      passwordHash,
      pinHash,
      isActive: true,
      syncId: id(),
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: chefId,
      username: 'chef',
      displayName: 'Andi Chef',
      role: 'chef',
      passwordHash,
      pinHash,
      isActive: true,
      syncId: id(),
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // -------------------------------------------------------
  // E-002: UserPermissions — waiter + chef defaults
  // -------------------------------------------------------
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
    await db.userPermissions.add({
      id: id(), userId: waiterId, permissionKey: p.key, isGranted: p.granted,
      syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now,
    });
  }
  for (const p of chefPerms) {
    await db.userPermissions.add({
      id: id(), userId: chefId, permissionKey: p.key, isGranted: p.granted,
      syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now,
    });
  }

  // -------------------------------------------------------
  // E-004: MenuCategories
  // -------------------------------------------------------
  const catMakananId = id();
  const catMinumanId = id();
  const catSnackId = id();

  await db.menuCategories.bulkAdd([
    { id: catMakananId, name: 'Makanan', sortOrder: 1, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: catMinumanId, name: 'Minuman', sortOrder: 2, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: catSnackId, name: 'Snack', sortOrder: 3, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-003: MenuItems — 6 items across 3 categories
  // -------------------------------------------------------
  const nasiGorengId = id();
  const mieAyamId = id();
  const ayamBakarId = id();
  const esJerukId = id();
  const kopiId = id();
  const kerupukId = id();

  await db.menuItems.bulkAdd([
    { id: nasiGorengId, itemName: 'Nasi Goreng Spesial', price: 25000, categoryId: catMakananId, description: 'Nasi goreng dengan telur, ayam, dan sayuran', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: mieAyamId, itemName: 'Mie Ayam Bakso', price: 20000, categoryId: catMakananId, description: 'Mie ayam dengan bakso sapi', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: ayamBakarId, itemName: 'Ayam Bakar Madu', price: 35000, categoryId: catMakananId, description: 'Ayam bakar dengan saus madu', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: esJerukId, itemName: 'Es Jeruk Segar', price: 8000, categoryId: catMinumanId, description: 'Jeruk peras dengan es batu', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: kopiId, itemName: 'Kopi Susu', price: 12000, categoryId: catMinumanId, description: 'Kopi hitam dengan susu kental manis', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: kerupukId, itemName: 'Kerupuk Udang', price: 5000, categoryId: catSnackId, description: 'Kerupuk udang renyah', isAvailable: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-008: InventoryItems — ingredients for recipes
  // -------------------------------------------------------
  const berasId = id();
  const ayamId = id();
  const mieId = id();
  const telurId = id();
  const jerukId = id();
  const kopiItemId = id();
  const susuId = id();
  const minyakId = id();

  await db.inventoryItems.bulkAdd([
    { id: berasId, itemName: 'Beras', quantity: 50, unit: 'kg', minimumThreshold: 10, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: ayamId, itemName: 'Ayam', quantity: 20, unit: 'kg', minimumThreshold: 5, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: mieId, itemName: 'Mie Telur', quantity: 30, unit: 'pack', minimumThreshold: 10, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: telurId, itemName: 'Telur', quantity: 100, unit: 'butir', minimumThreshold: 20, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: jerukId, itemName: 'Jeruk', quantity: 3, unit: 'kg', minimumThreshold: 5, stockStatus: 'low', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: kopiItemId, itemName: 'Kopi Bubuk', quantity: 5, unit: 'kg', minimumThreshold: 2, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: susuId, itemName: 'Susu Kental Manis', quantity: 15, unit: 'kaleng', minimumThreshold: 5, stockStatus: 'ok', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: minyakId, itemName: 'Minyak Goreng', quantity: 0.5, unit: 'liter', minimumThreshold: 2, stockStatus: 'critical', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-005: Recipes — linked to menu items
  // -------------------------------------------------------
  const recipeNasiGorengId = id();
  const recipeMieAyamId = id();
  const recipeAyamBakarId = id();

  await db.recipes.bulkAdd([
    { id: recipeNasiGorengId, menuItemId: nasiGorengId, cookingTime: 15, difficultyLevel: 'medium', notes: 'Goreng dengan api besar', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: recipeMieAyamId, menuItemId: mieAyamId, cookingTime: 10, difficultyLevel: 'easy', notes: 'Rebus mie hingga al dente', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: recipeAyamBakarId, menuItemId: ayamBakarId, cookingTime: 25, difficultyLevel: 'hard', notes: 'Marinasi minimal 30 menit sebelum bakar', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-006: RecipeIngredients — linked to inventory
  // -------------------------------------------------------
  await db.recipeIngredients.bulkAdd([
    // Nasi Goreng: beras, telur, minyak
    { id: id(), recipeId: recipeNasiGorengId, inventoryItemId: berasId, quantityRequired: 0.2, unit: 'kg', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeNasiGorengId, inventoryItemId: telurId, quantityRequired: 2, unit: 'butir', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeNasiGorengId, inventoryItemId: minyakId, quantityRequired: 0.05, unit: 'liter', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    // Mie Ayam: mie, ayam
    { id: id(), recipeId: recipeMieAyamId, inventoryItemId: mieId, quantityRequired: 1, unit: 'pack', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeMieAyamId, inventoryItemId: ayamId, quantityRequired: 0.15, unit: 'kg', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    // Ayam Bakar: ayam, minyak
    { id: id(), recipeId: recipeAyamBakarId, inventoryItemId: ayamId, quantityRequired: 0.3, unit: 'kg', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeAyamBakarId, inventoryItemId: minyakId, quantityRequired: 0.03, unit: 'liter', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-007: RecipeSteps — cooking instructions
  // -------------------------------------------------------
  await db.recipeSteps.bulkAdd([
    // Nasi Goreng steps
    { id: id(), recipeId: recipeNasiGorengId, stepOrder: 1, instruction: 'Panaskan minyak goreng di wajan besar', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeNasiGorengId, stepOrder: 2, instruction: 'Goreng telur orak-arik, sisihkan', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeNasiGorengId, stepOrder: 3, instruction: 'Masukkan nasi, aduk rata dengan bumbu', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeNasiGorengId, stepOrder: 4, instruction: 'Tambahkan telur, aduk hingga merata', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    // Mie Ayam steps
    { id: id(), recipeId: recipeMieAyamId, stepOrder: 1, instruction: 'Rebus mie dalam air mendidih 3 menit', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeMieAyamId, stepOrder: 2, instruction: 'Tiriskan mie, campur dengan minyak wijen', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeMieAyamId, stepOrder: 3, instruction: 'Sajikan dengan ayam suwir dan bakso', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    // Ayam Bakar steps
    { id: id(), recipeId: recipeAyamBakarId, stepOrder: 1, instruction: 'Marinasi ayam dengan bumbu madu minimal 30 menit', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeAyamBakarId, stepOrder: 2, instruction: 'Panggang di atas arang hingga matang', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), recipeId: recipeAyamBakarId, stepOrder: 3, instruction: 'Olesi saus madu, panggang 2 menit lagi', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-009: StockMovements — initial stock records
  // -------------------------------------------------------
  const inventoryIds = [berasId, ayamId, mieId, telurId, jerukId, kopiItemId, susuId, minyakId];
  const quantities = [50, 20, 30, 100, 3, 5, 15, 0.5];
  for (let i = 0; i < inventoryIds.length; i++) {
    await db.stockMovements.add({
      id: id(), inventoryItemId: inventoryIds[i], movementType: 'restock',
      quantityChange: quantities[i], reason: 'Stok awal', performedBy: 'system',
      syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now,
    });
  }

  // -------------------------------------------------------
  // E-010: Tables — 10 restaurant tables
  // -------------------------------------------------------
  for (let i = 1; i <= 10; i++) {
    await db.restaurantTables.add({
      id: id(), tableName: `Meja ${i}`, tableNumber: i, capacity: i <= 6 ? 4 : 6,
      status: 'available', syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now,
    });
  }

  // -------------------------------------------------------
  // E-016: Discounts — sample promos
  // -------------------------------------------------------
  await db.discounts.bulkAdd([
    { id: id(), discountName: 'Promo Weekday 10%', discountType: 'percentage', discountValue: 10, appliedTo: 'whole_order', isActive: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), discountName: 'Diskon Member Rp 5.000', discountType: 'fixed_amount', discountValue: 5000, appliedTo: 'whole_order', isActive: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-017: KitchenNotifications — empty (created during flow)
  // -------------------------------------------------------
  // No initial data needed — created when chef marks order as ready

  // -------------------------------------------------------
  // E-018: PosSettings
  // -------------------------------------------------------
  const settingsId = id();
  await db.posSettings.add({
    id: settingsId,
    ppnEnabled: true,
    ppnRate: 11,
    restaurantName: 'Restoran UMKM Logia',
    restaurantAddress: 'Jl. Merdeka No. 123, Jakarta',
    receiptFooter: 'Terima kasih atas kunjungan Anda!',
    showPpnOnReceipt: true,
    syncId: id(),
    syncStatus: 'synced',
    createdAt: now,
    updatedAt: now,
  });

  // -------------------------------------------------------
  // E-019: EwalletProviders
  // -------------------------------------------------------
  await db.ewalletProviders.bulkAdd([
    { id: id(), posSettingsId: settingsId, providerName: 'GoPay', isEnabled: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), posSettingsId: settingsId, providerName: 'OVO', isEnabled: true, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), posSettingsId: settingsId, providerName: 'Dana', isEnabled: false, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
    { id: id(), posSettingsId: settingsId, providerName: 'ShopeePay', isEnabled: false, syncId: id(), syncStatus: 'synced', createdAt: now, updatedAt: now },
  ]);

  // -------------------------------------------------------
  // E-011, E-012, E-013, E-014, E-015: Orders, OrderItems,
  // Transactions, Shifts, VoidRecords — empty on seed
  // These are created during user flows (shift open, order, payment)
  // -------------------------------------------------------

  console.log('[Seed] Client database seeded with comprehensive test data');
  console.log('[Seed] Users: owner/admin123, kasir/admin123, chef/admin123 (PIN: 123456)');
  console.log('[Seed] Menu: 6 items, 3 categories, 3 recipes with ingredients');
  console.log('[Seed] Inventory: 8 items (1 low, 1 critical for alert testing)');
  console.log('[Seed] Tables: 10, Discounts: 2, E-wallet providers: 4');
}
