import prisma from '../../prisma';
import { AppError } from '../../middleware/errorHandler';

// --- POS Settings ---

export async function getSettings() {
  let settings = await prisma.posSettings.findFirst({
    include: {
      ewalletProviders: {
        select: {
          id: true,
          providerName: true,
          isEnabled: true,
          qrImageUrl: true,
        },
        orderBy: { providerName: 'asc' },
      },
    },
  });

  if (!settings) {
    settings = await prisma.posSettings.create({
      data: {
        ppnEnabled: true,
        ppnRate: 11,
        showPpnOnReceipt: true,
      },
      include: {
        ewalletProviders: {
          select: {
            id: true,
            providerName: true,
            isEnabled: true,
            qrImageUrl: true,
          },
        },
      },
    });
  }

  return {
    id: settings.id,
    ppnEnabled: settings.ppnEnabled,
    ppnRate: settings.ppnRate,
    restaurantName: settings.restaurantName,
    restaurantAddress: settings.restaurantAddress,
    receiptFooter: settings.receiptFooter,
    showPpnOnReceipt: settings.showPpnOnReceipt,
    qrisImageUrl: settings.qrisImageUrl,
    bankName: settings.bankName,
    bankAccountNumber: settings.bankAccountNumber,
    bankAccountHolder: settings.bankAccountHolder,
    restaurantLogoUrl: settings.restaurantLogoUrl,
    ewalletProviders: settings.ewalletProviders,
  };
}

export async function updateSettings(data: {
  ppnEnabled?: boolean;
  ppnRate?: number;
  restaurantName?: string;
  restaurantAddress?: string;
  receiptFooter?: string;
  showPpnOnReceipt?: boolean;
  qrisImageUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  restaurantLogoUrl?: string;
}) {
  let settings = await prisma.posSettings.findFirst();

  if (!settings) {
    settings = await prisma.posSettings.create({
      data: {
        ppnEnabled: true,
        ppnRate: 11,
        showPpnOnReceipt: true,
      },
    });
  }

  const updated = await prisma.posSettings.update({
    where: { id: settings.id },
    data,
  });

  return {
    id: updated.id,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// --- E-Wallet Providers ---

export async function listEwalletProviders(filters: { isEnabled?: boolean }) {
  const where: any = {};
  if (filters.isEnabled !== undefined) where.isEnabled = filters.isEnabled;

  const providers = await prisma.ewalletProvider.findMany({
    where,
    select: {
      id: true,
      providerName: true,
      isEnabled: true,
      qrImageUrl: true,
    },
    orderBy: { providerName: 'asc' },
  });

  return { providers };
}

export async function updateEwalletProvider(
  id: string,
  data: { isEnabled?: boolean; qrImageUrl?: string },
) {
  const provider = await prisma.ewalletProvider.findUnique({ where: { id } });
  if (!provider) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'E-wallet provider not found');
  }

  const updated = await prisma.ewalletProvider.update({
    where: { id },
    data,
  });

  return {
    id: updated.id,
    providerName: updated.providerName,
    isEnabled: updated.isEnabled,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// --- Discounts ---

export async function listDiscounts(filters: { isActive?: boolean }) {
  const where: any = {};
  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  const discounts = await prisma.discount.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return {
    discounts: discounts.map((d) => ({
      id: d.id,
      discountName: d.discountName,
      discountType: d.discountType,
      discountValue: d.discountValue,
      appliedTo: d.appliedTo,
      isActive: d.isActive,
    })),
    total: discounts.length,
  };
}

export async function createDiscount(data: {
  discountName: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  appliedTo: 'whole_order' | 'specific_items';
  isActive?: boolean;
}) {
  const discount = await prisma.discount.create({
    data: {
      discountName: data.discountName,
      discountType: data.discountType,
      discountValue: data.discountValue,
      appliedTo: data.appliedTo,
      isActive: data.isActive ?? true,
    },
  });

  return {
    id: discount.id,
    discountName: discount.discountName,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    isActive: discount.isActive,
    createdAt: discount.createdAt.toISOString(),
  };
}

export async function updateDiscount(
  id: string,
  data: {
    discountName?: string;
    discountType?: 'percentage' | 'fixed_amount';
    discountValue?: number;
    appliedTo?: 'whole_order' | 'specific_items';
    isActive?: boolean;
  },
) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) {
    throw new AppError(404, 'DISCOUNT_NOT_FOUND', 'Discount not found');
  }

  const updated = await prisma.discount.update({
    where: { id },
    data,
  });

  return {
    id: updated.id,
    discountName: updated.discountName,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteDiscount(id: string) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) {
    throw new AppError(404, 'DISCOUNT_NOT_FOUND', 'Discount not found');
  }

  const activeOrders = await prisma.order.findFirst({
    where: {
      discountId: id,
      orderStatus: { in: ['pending', 'cooking', 'ready', 'served'] },
    },
  });

  if (activeOrders) {
    throw new AppError(409, 'DISCOUNT_IN_USE', 'Cannot delete discount applied to active orders');
  }

  await prisma.discount.delete({ where: { id } });
  return { message: 'Discount deleted successfully' };
}
