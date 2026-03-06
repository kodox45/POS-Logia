# Logia POS

Sistem kasir (Point of Sale) offline-first untuk restoran UMKM. Dibangun dengan React, TypeScript, dan arsitektur offline-first menggunakan IndexedDB untuk operasi lokal dan PostgreSQL untuk sinkronisasi data ke server.

## Fitur Utama

- **Multi-Interface** — 4 tampilan berbeda: Dashboard Hub, POS Kasir/Waiter, Kitchen Display, Admin Panel
- **Offline-First** — Semua operasi berjalan tanpa internet menggunakan IndexedDB (Dexie.js)
- **Sinkronisasi** — Sync engine dengan conflict resolution untuk sinkronisasi data ke server
- **Manajemen Pesanan** — Buat pesanan, pilih meja, kelola item, catatan khusus
- **Pembayaran** — Tunai, e-wallet, diskon (persentase & nominal), PPN otomatis
- **Kitchen Display** — Tampilan dapur real-time dengan notifikasi pesanan baru
- **Manajemen Menu** — CRUD menu dengan kategori, ketersediaan, dan harga
- **Resep & Bahan** — Panduan resep dengan langkah-langkah dan linkage ke inventaris
- **Inventaris** — Stok otomatis terpotong saat pesanan, peringatan stok rendah
- **Shift Management** — Buka/tutup shift dengan saldo kas dan rekonsiliasi
- **Laporan** — Dashboard ringkasan penjualan, transaksi, dan performa
- **Manajemen User** — Role-based access control (Owner, Kasir/Waiter, Chef)
- **PWA** — Installable sebagai Progressive Web App

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State Management | Zustand |
| Local Database | Dexie.js (IndexedDB) |
| Backend | Express.js, TypeScript |
| Server Database | PostgreSQL, Prisma ORM |
| Validasi | Zod |
| Icons | Lucide React |
| Auth | bcrypt.js (local hash) |

## Prasyarat

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PostgreSQL** >= 14.x (hanya diperlukan jika ingin menjalankan backend/sync)

## Instalasi & Setup

### 1. Clone Repository

```bash
git clone https://github.com/kodox45/POS-Logia.git
cd POS-Logia
```

### 2. Setup Frontend

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Frontend akan berjalan di **http://localhost:4173**

> **Catatan:** Frontend bisa dijalankan secara mandiri tanpa backend. Semua data disimpan di IndexedDB browser (offline-first). Backend hanya diperlukan untuk sinkronisasi multi-device.

### 3. Setup Backend (Opsional — untuk sync)

#### a. Buat database PostgreSQL

```bash
# Login ke PostgreSQL
psql -U postgres

# Buat database
CREATE DATABASE logia_pos;
\q
```

#### b. Konfigurasi environment

```bash
# Buat file .env di folder server/
cd server
cp .env.example .env  # atau buat manual
```

Isi file `server/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/logia_pos"
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:4173,http://localhost:5173
```

#### c. Install dependencies & setup database

```bash
# Dari folder server/
npm install

# Generate Prisma client
npx prisma generate --schema=../prisma/schema.prisma

# Push schema ke database
npx prisma db push --schema=../prisma/schema.prisma

# (Opsional) Seed data awal
npx ts-node ../prisma/seed.ts
```

#### d. Jalankan backend server

```bash
# Dari folder server/
npm run dev
```

Backend akan berjalan di **http://localhost:3001**

### 4. Menjalankan Full Stack (Frontend + Backend)

Buka 2 terminal:

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Backend
cd server && npm run dev
```

## Akun Demo

Saat pertama kali membuka aplikasi, data seed akan otomatis dimuat ke IndexedDB:

| Username | Password | PIN | Role | Akses |
|----------|----------|-----|------|-------|
| `owner` | `admin123` | `123456` | Owner | Semua fitur + Admin Panel |
| `kasir` | `admin123` | `123456` | Waiter-Cashier | POS, Pesanan, Pembayaran |
| `chef` | `admin123` | `123456` | Chef | Kitchen Display, Resep |

## Struktur Proyek

```
POS-Logia/
├── src/                          # Frontend source
│   ├── components/               # Reusable components
│   │   ├── common/               # ErrorBoundary, LoadingSpinner
│   │   ├── kitchen/              # KitchenOrderCard, NewOrderAlert
│   │   ├── layout/               # 4 layout (Dashboard, POS, Kitchen, Admin)
│   │   ├── navigation/           # Guards (Auth, Role, Permission, PIN, Shift)
│   │   ├── order/                # OrderCard, MenuItemCard, TableSelector
│   │   └── payment/              # Numpad, DiscountPicker, VoidModal
│   ├── db/                       # Dexie database & seed
│   ├── hooks/                    # Custom hooks (useOnlineStatus)
│   ├── lib/                      # Constants, calculations, utilities
│   ├── pages/                    # Semua halaman
│   │   ├── admin/                # 7 halaman admin
│   │   ├── auth/                 # LoginPage
│   │   ├── dashboard/            # DashboardHubPage
│   │   ├── kitchen/              # KitchenQueue, RecipeViewer
│   │   ├── pos/                  # OrderList, CreateOrder, Payment, TableMap
│   │   └── shift/                # OpenShift, CloseShift
│   ├── stores/                   # 10 Zustand stores
│   ├── sync/                     # Sync engine, change tracker, conflict resolver
│   └── types/                    # Entity types, enums
├── server/                       # Backend source
│   └── src/
│       ├── middleware/            # Auth, error handler
│       ├── routes/               # 12 route modules
│       └── services/             # Business logic per domain
├── prisma/                       # Prisma schema & seed
├── public/                       # PWA manifest, service worker
└── prototype/                    # HTML prototype (referensi desain)
```

## Scripts

### Frontend

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Jalankan dev server (port 4173) |
| `npm run build` | Build untuk production |
| `npm run preview` | Preview production build |
| `npm run test` | Jalankan unit tests |

### Backend

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Jalankan dev server (port 3001) |
| `npm run build` | Compile TypeScript |
| `npm run start` | Jalankan production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema ke database |
| `npm run db:seed` | Seed data awal |
| `npm run db:migrate` | Jalankan migrasi database |

## API Endpoints

Backend menyediakan REST API di `/api`:

| Domain | Base Path | Endpoints |
|--------|-----------|-----------|
| Auth | `/api/auth` | login, logout, verify-pin, session |
| Users | `/api/users` | CRUD, permissions |
| Menu | `/api/menu-items`, `/api/menu-categories` | CRUD, availability |
| Recipes | `/api/recipes` | CRUD dengan ingredients & steps |
| Orders | `/api/orders`, `/api/tables` | CRUD, status updates |
| Kitchen | `/api/kitchen` | Queue, notifications, status |
| Payment | `/api/payments` | Process, void, transactions |
| Inventory | `/api/inventory` | CRUD, restock, stock check |
| Shifts | `/api/shifts` | Open, close, reporting |
| Reports | `/api/reports` | Sales summary, daily reports |
| Settings | `/api/settings` | POS config, PPN, e-wallet |
| Sync | `/api/sync` | Push, pull, status |

## Lisensi

Private project.
