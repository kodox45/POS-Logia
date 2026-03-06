// Screen: S-017 | Interface: admin-panel | Roles: owner
import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  Save, X, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Receipt, Building2, CreditCard, Percent, Tag,
} from 'lucide-react';
import clsx from 'clsx';
import type { Discount, EwalletProvider } from '@/types';

function generateId(): string {
  return crypto.randomUUID();
}

export default function SystemSettingsPage() {
  const {
    posSettings, ewalletProviders, discounts, loading, error,
    loadSettings, initializeSettings, togglePPN, updatePPNRate,
    updateRestaurantInfo, configurePaymentMethods,
    addDiscount, updateDiscount, deleteDiscount, toggleDiscountActive,
  } = useSettingsStore();

  const [ppnRate, setPpnRate] = useState('11');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [showPpnOnReceipt, setShowPpnOnReceipt] = useState(true);
  const [qrisImageUrl, setQrisImageUrl] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [discountModal, setDiscountModal] = useState<Discount | 'new' | null>(null);
  const [localProviders, setLocalProviders] = useState<EwalletProvider[]>([]);

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      const store = useSettingsStore.getState();
      if (!store.posSettings) {
        await initializeSettings();
      }
    };
    init();
  }, [loadSettings, initializeSettings]);

  useEffect(() => {
    if (posSettings) {
      setPpnRate(posSettings.ppnRate?.toString() ?? '11');
      setRestaurantName(posSettings.restaurantName ?? '');
      setRestaurantAddress(posSettings.restaurantAddress ?? '');
      setReceiptFooter(posSettings.receiptFooter ?? '');
      setShowPpnOnReceipt(posSettings.showPpnOnReceipt ?? true);
      setQrisImageUrl(posSettings.qrisImageUrl ?? '');
      setBankName(posSettings.bankName ?? '');
      setBankAccountNumber(posSettings.bankAccountNumber ?? '');
      setBankAccountHolder(posSettings.bankAccountHolder ?? '');
    }
  }, [posSettings]);

  useEffect(() => {
    if (ewalletProviders.length > 0) {
      setLocalProviders([...ewalletProviders]);
    } else {
      // Initialize default e-wallet providers if none exist
      const defaults = ['GoPay', 'OVO', 'Dana', 'ShopeePay'];
      const now = new Date().toISOString();
      setLocalProviders(defaults.map((name) => ({
        id: generateId(),
        posSettingsId: posSettings?.id ?? '',
        providerName: name,
        isEnabled: false,
        syncId: generateId(),
        syncStatus: 'pending' as const,
        createdAt: now,
        updatedAt: now,
      })));
    }
  }, [ewalletProviders, posSettings?.id]);

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const rate = parseFloat(ppnRate) || 11;
      await updatePPNRate(rate);
      await updateRestaurantInfo({
        restaurantName: restaurantName || undefined,
        restaurantAddress: restaurantAddress || undefined,
        receiptFooter: receiptFooter || undefined,
        showPpnOnReceipt,
        qrisImageUrl: qrisImageUrl || undefined,
        bankName: bankName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        bankAccountHolder: bankAccountHolder || undefined,
      });
      await configurePaymentMethods(localProviders);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = (id: string) => {
    setLocalProviders((prev) =>
      prev.map((p) => p.id === id ? { ...p, isEnabled: !p.isEnabled, updatedAt: new Date().toISOString() } : p)
    );
  };

  const updateProviderQr = (id: string, url: string) => {
    setLocalProviders((prev) =>
      prev.map((p) => p.id === id ? { ...p, qrImageUrl: url || undefined, updatedAt: new Date().toISOString() } : p)
    );
  };

  if (loading && !posSettings) {
    return <div className="text-center py-12 text-text-secondary">Memuat pengaturan...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Pengaturan POS</h1>
        <button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {saveSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">Pengaturan berhasil disimpan.</div>}

      <div className="space-y-6">
        {/* PPN / Tax Settings */}
        <Section icon={<Percent size={18} />} title="Pengaturan PPN / Pajak">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-text-primary font-medium">PPN Aktif</p>
              <p className="text-xs text-text-secondary">Aktifkan/nonaktifkan perhitungan PPN pada transaksi</p>
            </div>
            <button onClick={togglePPN} className="text-2xl">
              {posSettings?.ppnEnabled
                ? <ToggleRight size={32} className="text-primary" />
                : <ToggleLeft size={32} className="text-border" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tarif PPN (%)</label>
              <input type="number" value={ppnRate} onChange={(e) => setPpnRate(e.target.value)} min="0" max="100" step="0.1" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div className="flex items-end">
              <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-full">
                <span className="text-text-secondary">Contoh: Subtotal Rp 100.000 </span>
                <span className="text-primary font-medium">PPN: Rp {((100000 * (parseFloat(ppnRate) || 0)) / 100).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Payment Methods */}
        <Section icon={<CreditCard size={18} />} title="Metode Pembayaran">
          <div className="space-y-4">
            {/* QRIS */}
            <div className="bg-background border border-border/50 rounded-lg p-3">
              <p className="text-sm text-text-primary font-medium mb-2">QRIS</p>
              <div>
                <label className="block text-xs text-text-secondary mb-1">URL Gambar QR Code QRIS</label>
                <input value={qrisImageUrl} onChange={(e) => setQrisImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="bg-background border border-border/50 rounded-lg p-3">
              <p className="text-sm text-text-primary font-medium mb-2">Transfer Bank</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Nama Bank</label>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">No. Rekening</label>
                  <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Atas Nama</label>
                  <input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
                </div>
              </div>
            </div>

            {/* E-Wallets */}
            <div className="bg-background border border-border/50 rounded-lg p-3">
              <p className="text-sm text-text-primary font-medium mb-2">E-Wallet</p>
              <div className="space-y-3">
                {localProviders.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <button onClick={() => toggleProvider(p.id)} className="shrink-0">
                      {p.isEnabled
                        ? <ToggleRight size={24} className="text-primary" />
                        : <ToggleLeft size={24} className="text-border" />}
                    </button>
                    <span className={clsx('text-sm w-24', p.isEnabled ? 'text-text-primary' : 'text-text-secondary')}>{p.providerName}</span>
                    {p.isEnabled && (
                      <input
                        value={p.qrImageUrl ?? ''}
                        onChange={(e) => updateProviderQr(p.id, e.target.value)}
                        placeholder="URL QR Code"
                        className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Discount Management */}
        <Section icon={<Tag size={18} />} title="Manajemen Diskon / Promo">
          <div className="flex justify-end mb-3">
            <button onClick={() => setDiscountModal('new')} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus size={14} /> Tambah Diskon
            </button>
          </div>
          {discounts.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-4">Belum ada diskon. Klik "Tambah Diskon" untuk membuat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="text-left px-3 py-2 font-medium">Nama</th>
                    <th className="text-center px-3 py-2 font-medium">Tipe</th>
                    <th className="text-right px-3 py-2 font-medium">Nilai</th>
                    <th className="text-center px-3 py-2 font-medium">Berlaku</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                    <th className="text-center px-3 py-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-text-primary">{d.discountName}</td>
                      <td className="px-3 py-2 text-center text-text-secondary">{d.discountType === 'percentage' ? 'Persentase' : 'Nominal'}</td>
                      <td className="px-3 py-2 text-right text-text-primary font-mono">{d.discountType === 'percentage' ? `${d.discountValue}%` : `Rp ${d.discountValue.toLocaleString('id-ID')}`}</td>
                      <td className="px-3 py-2 text-center text-text-secondary text-xs">{d.appliedTo === 'whole_order' ? 'Seluruh Order' : 'Item Tertentu'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleDiscountActive(d.id)}>
                          {d.isActive
                            ? <ToggleRight size={20} className="text-green-400" />
                            : <ToggleLeft size={20} className="text-border" />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setDiscountModal(d)} className="p-1 hover:bg-primary/10 rounded text-primary"><Edit2 size={14} /></button>
                          <button onClick={() => deleteDiscount(d.id)} className="p-1 hover:bg-red-500/10 rounded text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Restaurant Info */}
        <Section icon={<Building2 size={18} />} title="Informasi Restoran">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nama Restoran</label>
              <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Alamat</label>
              <textarea value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary resize-none" />
            </div>
          </div>
        </Section>

        {/* Receipt Settings */}
        <Section icon={<Receipt size={18} />} title="Pengaturan Struk">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Footer Struk (teks di bawah struk)</label>
              <input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder="Terima kasih atas kunjungan Anda" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Tampilkan PPN di Struk</p>
                <p className="text-xs text-text-secondary">Tampilkan rincian PPN pada struk yang dicetak</p>
              </div>
              <button onClick={() => setShowPpnOnReceipt(!showPpnOnReceipt)}>
                {showPpnOnReceipt
                  ? <ToggleRight size={28} className="text-primary" />
                  : <ToggleLeft size={28} className="text-border" />}
              </button>
            </div>
          </div>
        </Section>
      </div>

      {/* Bottom Save Button */}
      <div className="mt-8 flex justify-end">
        <button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
        </button>
      </div>

      {/* Discount Form Modal */}
      {discountModal && (
        <DiscountFormModal
          discount={discountModal === 'new' ? null : discountModal}
          onClose={() => setDiscountModal(null)}
          onSave={async (data) => {
            if (discountModal === 'new') {
              await addDiscount(data);
            } else {
              await updateDiscount((discountModal as Discount).id, data);
            }
            setDiscountModal(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DiscountFormModal({ discount, onClose, onSave }: {
  discount: Discount | null;
  onClose: () => void;
  onSave: (data: { discountName: string; discountType: 'percentage' | 'fixed_amount'; discountValue: number; appliedTo: 'whole_order' | 'specific_items'; isActive?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(discount?.discountName ?? '');
  const [type, setType] = useState<'percentage' | 'fixed_amount'>(discount?.discountType ?? 'percentage');
  const [value, setValue] = useState(discount?.discountValue?.toString() ?? '');
  const [appliedTo, setAppliedTo] = useState<'whole_order' | 'specific_items'>(discount?.appliedTo ?? 'whole_order');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value) return;
    setSaving(true);
    await onSave({
      discountName: name.trim(),
      discountType: type,
      discountValue: parseFloat(value),
      appliedTo,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{discount ? 'Edit Diskon' : 'Tambah Diskon Baru'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Nama Diskon</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Weekday 10%" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tipe</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed_amount')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
                <option value="percentage">Persentase (%)</option>
                <option value="fixed_amount">Nominal (Rp)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nilai</label>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} min="0" step="any" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Berlaku Untuk</label>
            <select value={appliedTo} onChange={(e) => setAppliedTo(e.target.value as 'whole_order' | 'specific_items')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
              <option value="whole_order">Seluruh Order</option>
              <option value="specific_items">Item Tertentu</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
