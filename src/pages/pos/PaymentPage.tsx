// Screen: S-004 | Interface: waiter-cashier-ui | Roles: waiter-cashier, owner
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import { clsx } from 'clsx';
import { useOrderManagementStore } from '@/stores/useOrderManagementStore';
import { usePaymentStore } from '@/stores/usePaymentStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { Numpad } from '@/components/payment/Numpad';
import { PaymentSuccessPopup } from '@/components/payment/PaymentSuccessPopup';
import { VoidTransactionModal } from '@/components/payment/VoidTransactionModal';
import { DiscountPicker } from '@/components/payment/DiscountPicker';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { PaymentMethod, VoidReason } from '@/types/enums';
import type { Transaction, Discount } from '@/types';

type PaymentTab = 'tunai' | 'qris' | 'ewallet' | 'transfer';

const PAYMENT_TAB_CONFIG: { key: PaymentTab; label: string; methods: PaymentMethod[] }[] = [
  { key: 'tunai', label: 'Tunai', methods: ['tunai'] },
  { key: 'qris', label: 'QRIS', methods: ['qris'] },
  { key: 'ewallet', label: 'E-Wallet', methods: ['gopay', 'ovo', 'dana', 'shopeepay'] },
  { key: 'transfer', label: 'Transfer', methods: ['transfer_bank'] },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  transfer_bank: 'Transfer Bank',
};

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<PaymentTab>('tunai');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('tunai');
  const [amountInput, setAmountInput] = useState('0');
  const [digitalRef, setDigitalRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidProcessing, setVoidProcessing] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>();

  const { orders, orderItems, tables, loadOrders, loadTables } = useOrderManagementStore();
  const {
    processPayment,
    processVoid,
    calculatePPN,
    applyDiscount,
    loadTransactions,
    getTransactionByOrderId,
  } = usePaymentStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const verifyPin = useAuthStore((s) => s.verifyPin);
  const activeShift = useShiftManagementStore((s) => s.activeShift);
  const { posSettings, discounts, loadSettings } = useSettingsStore();
  const getActiveDiscounts = useSettingsStore((s) => s.getActiveDiscounts);

  useEffect(() => {
    loadOrders();
    loadTables();
    loadSettings();
    loadTransactions();
  }, [loadOrders, loadTables, loadSettings, loadTransactions]);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const items = useMemo(() => orderItems.filter((i) => i.orderId === orderId), [orderItems, orderId]);
  const table = useMemo(() => order ? tables.find((t) => t.id === order.tableId) : undefined, [order, tables]);
  const existingTransaction = useMemo(() => orderId ? getTransactionByOrderId(orderId) : undefined, [orderId, getTransactionByOrderId]);

  const activeDiscountList = useMemo(() => getActiveDiscounts(), [getActiveDiscounts]);
  const ppnRate = posSettings?.ppnEnabled ? (posSettings.ppnRate ?? 11) : 0;

  const subtotal = order?.subtotalAmount ?? 0;
  const discountAmount = order?.discountAmount ?? 0;
  const ppnAmount = calculatePPN(subtotal, discountAmount, ppnRate);
  const grandTotal = (subtotal - discountAmount) + ppnAmount;
  const amountPaid = parseInt(amountInput, 10) || 0;
  const changeAmount = activeTab === 'tunai' ? Math.max(0, amountPaid - grandTotal) : 0;
  const canPay = activeTab === 'tunai' ? amountPaid >= grandTotal : true;
  const isPaid = order?.orderStatus === 'paid';
  const isVoided = order?.orderStatus === 'voided';

  const handleTabChange = useCallback((tab: PaymentTab) => {
    setActiveTab(tab);
    const methods = PAYMENT_TAB_CONFIG.find((t) => t.key === tab)?.methods ?? [];
    if (methods.length === 1) {
      setSelectedMethod(methods[0]);
    }
    if (tab !== 'tunai') {
      setAmountInput(String(Math.ceil(grandTotal)));
    } else {
      setAmountInput('0');
    }
  }, [grandTotal]);

  const handleSelectDiscount = useCallback(async (discount: Discount) => {
    if (!order || !orderId) return;
    try {
      await applyDiscount(orderId, discount, order);
      await loadOrders();
    } catch {
      // error in store
    }
  }, [order, orderId, applyDiscount, loadOrders]);

  const handleRemoveDiscount = useCallback(async () => {
    // Re-set discount to zero by updating the order directly
    if (!orderId) return;
    try {
      const { db } = await import('@/db/database');
      const currentOrder = orders.find((o) => o.id === orderId);
      if (!currentOrder) return;
      const newPpn = (currentOrder.subtotalAmount) * (currentOrder.ppnRate / 100);
      const newGrand = currentOrder.subtotalAmount + newPpn;
      await db.orders.update(orderId, {
        discountId: undefined,
        discountAmount: 0,
        ppnAmount: newPpn,
        grandTotal: newGrand,
        updatedAt: new Date().toISOString(),
      });
      await loadOrders();
    } catch {
      // error silently
    }
  }, [orderId, orders, loadOrders]);

  const handleProcessPayment = useCallback(async () => {
    if (!order || !orderId || !currentUser || !activeShift || !table) return;
    if (!canPay) return;

    setProcessing(true);
    try {
      const transaction = await processPayment({
        orderId,
        paymentMethod: selectedMethod,
        amountPaid: activeTab === 'tunai' ? amountPaid : grandTotal,
        digitalPaymentRef: digitalRef || undefined,
        shiftId: activeShift.id,
        cashierId: currentUser.id,
        tableNumber: table.tableNumber,
        subtotalAmount: subtotal,
        discountName: order.discount?.discountName,
        discountAmount,
        ppnRate,
      });
      setCompletedTransaction(transaction);
      await loadOrders();
      await loadTables();
    } catch {
      // error in store
    } finally {
      setProcessing(false);
    }
  }, [
    order, orderId, currentUser, activeShift, table, canPay,
    processPayment, selectedMethod, activeTab, amountPaid,
    grandTotal, digitalRef, subtotal, discountAmount, ppnRate,
    loadOrders, loadTables,
  ]);

  const handleVoid = useCallback(async (reason: VoidReason, notes: string, pin: string) => {
    if (!order || !orderId || !currentUser || !activeShift) return;

    setVoidProcessing(true);
    setPinError(undefined);
    try {
      const pinValid = await verifyPin(currentUser.id, pin);
      if (!pinValid) {
        setPinError('PIN tidak valid');
        setVoidProcessing(false);
        return;
      }

      await processVoid({
        orderId,
        voidType: 'full_void',
        voidReason: reason,
        voidNotes: notes || undefined,
        voidedBy: currentUser.id,
        shiftId: activeShift.id,
        voidAmount: existingTransaction?.grandTotal ?? grandTotal,
        pinVerifiedAt: new Date().toISOString(),
      });

      setShowVoidModal(false);
      await loadOrders();
      navigate('/pos/orders');
    } catch {
      // error in store
    } finally {
      setVoidProcessing(false);
    }
  }, [order, orderId, currentUser, activeShift, verifyPin, processVoid, existingTransaction, grandTotal, loadOrders, navigate]);

  const handlePrintReceipt = useCallback(() => {
    window.print();
  }, []);

  const handleDone = useCallback(() => {
    setCompletedTransaction(null);
    navigate('/pos/orders');
  }, [navigate]);

  if (!order) {
    return <LoadingSpinner size="lg" message="Memuat data pesanan..." />;
  }

  return (
    <div className="flex flex-col h-full -m-4">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos/orders')}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Kembali"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-text-primary font-medium text-sm">Pembayaran</h1>
            <p className="text-text-secondary text-xs">
              {order.orderNumber} - {table?.tableName ?? `Meja`}
            </p>
          </div>
        </div>
        {isPaid && !isVoided && (
          <button
            onClick={() => setShowVoidModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-error border border-error/30 rounded hover:bg-error/10 transition-colors"
          >
            <Ban size={14} />
            Void
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Order Detail */}
        <div className="flex-1 overflow-auto p-4">
          {/* Order Items */}
          <div className="bg-surface rounded-lg border border-border mb-4">
            <div className="p-4 border-b border-border">
              <h3 className="text-text-primary font-medium text-sm">Detail Pesanan</h3>
            </div>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary text-sm">{item.itemName}</span>
                      {item.isAdditional && (
                        <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                          Tambahan
                        </span>
                      )}
                    </div>
                    {item.specialNotes && (
                      <p className="text-text-secondary text-xs mt-0.5">{item.specialNotes}</p>
                    )}
                    <span className="text-text-secondary text-xs">
                      {item.quantity} x Rp {item.unitPrice.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-text-primary text-sm font-medium">
                    Rp {item.lineTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-surface rounded-lg border border-border p-4 space-y-2 mb-4">
            <div className="flex justify-between text-text-secondary text-sm">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>

            {/* Discount Selector */}
            {!isPaid && !isVoided && (
              <DiscountPicker
                discounts={activeDiscountList}
                selectedDiscountId={order.discountId ?? null}
                onSelect={handleSelectDiscount}
                onRemove={handleRemoveDiscount}
                currentDiscountName={order.discount?.discountName}
                currentDiscountAmount={discountAmount}
              />
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between text-success text-sm">
                <span>Diskon</span>
                <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-text-secondary text-sm">
              <span>PPN ({ppnRate}%)</span>
              <span>Rp {ppnAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-text-primary font-medium text-base pt-2 border-t border-border">
              <span>Grand Total</span>
              <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Status badges for paid/voided */}
          {isPaid && (
            <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
              <p className="text-success text-sm font-medium">Pesanan sudah dibayar</p>
            </div>
          )}
          {isVoided && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-3 text-center">
              <p className="text-error text-sm font-medium">Pesanan telah di-void</p>
            </div>
          )}
        </div>

        {/* Right: Payment Method (only show if not paid) */}
        {!isPaid && !isVoided && (
          <div className="hidden md:flex w-96 border-l border-border flex-col">
            {/* Payment Method Tabs */}
            <div className="flex border-b border-border">
              {PAYMENT_TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={clsx(
                    'flex-1 py-3 text-sm text-center transition-colors border-b-2',
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Payment Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'tunai' && (
                <div>
                  <div className="text-center mb-4">
                    <p className="text-text-secondary text-xs mb-1">Jumlah Dibayar</p>
                    <p className="text-text-primary text-2xl font-medium">
                      Rp {amountPaid.toLocaleString('id-ID')}
                    </p>
                    {amountPaid >= grandTotal && (
                      <p className="text-warning text-sm mt-1">
                        Kembalian: Rp {changeAmount.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  <Numpad value={amountInput} onChange={setAmountInput} />
                </div>
              )}

              {activeTab === 'qris' && (
                <div className="text-center">
                  {posSettings?.qrisImageUrl ? (
                    <div className="bg-white rounded-lg p-4 inline-block mb-4">
                      <img
                        src={posSettings.qrisImageUrl}
                        alt="QRIS QR Code"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface-elevated rounded-lg p-8 mb-4">
                      <p className="text-text-secondary text-sm">QRIS belum dikonfigurasi</p>
                    </div>
                  )}
                  <p className="text-text-primary text-lg font-medium mb-1">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </p>
                  <p className="text-text-secondary text-xs">Scan QR code untuk membayar</p>
                </div>
              )}

              {activeTab === 'ewallet' && (
                <div>
                  <p className="text-text-secondary text-xs mb-3">Pilih provider</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {PAYMENT_TAB_CONFIG.find((t) => t.key === 'ewallet')!.methods.map((method) => (
                      <button
                        key={method}
                        onClick={() => setSelectedMethod(method)}
                        className={clsx(
                          'px-4 py-3 text-sm rounded-lg border transition-colors',
                          selectedMethod === method
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-text-secondary hover:border-primary/30'
                        )}
                      >
                        {METHOD_LABELS[method]}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Nomor referensi (opsional)"
                    value={digitalRef}
                    onChange={(e) => setDigitalRef(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-elevated text-text-primary text-sm rounded-lg border border-border focus:border-primary focus:outline-none"
                    aria-label="Nomor referensi pembayaran"
                  />
                  <p className="text-text-primary text-lg font-medium text-center mt-4">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </p>
                </div>
              )}

              {activeTab === 'transfer' && (
                <div>
                  {posSettings?.bankName ? (
                    <div className="bg-surface-elevated rounded-lg p-4 mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Bank</span>
                        <span className="text-text-primary">{posSettings.bankName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">No. Rekening</span>
                        <span className="text-text-primary font-mono">{posSettings.bankAccountNumber}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Atas Nama</span>
                        <span className="text-text-primary">{posSettings.bankAccountHolder}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-elevated rounded-lg p-4 mb-4">
                      <p className="text-text-secondary text-sm text-center">Info bank belum dikonfigurasi</p>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Nomor referensi transfer"
                    value={digitalRef}
                    onChange={(e) => setDigitalRef(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-elevated text-text-primary text-sm rounded-lg border border-border focus:border-primary focus:outline-none mb-4"
                    aria-label="Nomor referensi transfer"
                  />
                  <p className="text-text-primary text-lg font-medium text-center">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Payment Button */}
            <div className="p-4 border-t border-border">
              <button
                onClick={handleProcessPayment}
                disabled={!canPay || processing}
                className="w-full py-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Memproses...' : `Bayar Rp ${grandTotal.toLocaleString('id-ID')}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Payment section at bottom (only if not paid) */}
      {!isPaid && !isVoided && (
        <div className="md:hidden bg-surface border-t border-border px-4 py-3 safe-bottom">
          {/* Payment Method Tabs (mobile) */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {PAYMENT_TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={clsx(
                  'shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors',
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-text-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'tunai' && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-secondary text-xs">Dibayar: Rp {amountPaid.toLocaleString('id-ID')}</span>
              {changeAmount > 0 && (
                <span className="text-warning text-xs">Kembalian: Rp {changeAmount.toLocaleString('id-ID')}</span>
              )}
            </div>
          )}

          <button
            onClick={handleProcessPayment}
            disabled={!canPay || processing}
            className="w-full py-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? 'Memproses...' : `Bayar Rp ${grandTotal.toLocaleString('id-ID')}`}
          </button>
        </div>
      )}

      {/* Success Popup */}
      {completedTransaction && (
        <PaymentSuccessPopup
          transaction={completedTransaction}
          isOpen={true}
          onPrintReceipt={handlePrintReceipt}
          onDone={handleDone}
        />
      )}

      {/* Void Modal */}
      <VoidTransactionModal
        isOpen={showVoidModal}
        orderNumber={order.orderNumber}
        voidAmount={existingTransaction?.grandTotal ?? grandTotal}
        onConfirm={handleVoid}
        onClose={() => {
          setShowVoidModal(false);
          setPinError(undefined);
        }}
        verifyingPin={voidProcessing}
        pinError={pinError}
      />
    </div>
  );
}
