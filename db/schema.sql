CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    price_per_night REAL NOT NULL,
    amenities TEXT DEFAULT '{}',
    add_ons TEXT DEFAULT '{}'
);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    email TEXT,
    id_type TEXT,
    id_number TEXT,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id TEXT UNIQUE NOT NULL,   -- ✅ NEW FIELD
    customer_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    price REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- ================== CATEGORIES ==================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- ================== MENU ITEMS ==================
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,           -- references categories.name
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending / Preparing / Served
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ================== KITCHEN ORDERS ==================
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,         -- references rooms.id
    item_id INTEGER NOT NULL,         -- references menu_items.id
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending / Preparing / Served
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (item_id) REFERENCES menu_items(id)
);
CREATE TABLE IF NOT EXISTS add_ons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS billings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT,
  customer_id INTEGER,
  room_id INTEGER,
  check_in TEXT,
  check_out TEXT,
  room_price REAL,
  add_ons TEXT,
  kitchen_orders TEXT,
  total_amount REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);