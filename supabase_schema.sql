-- Supabase SQL Schema for Shopify Integration
-- Clean, production-grade schema with multi-tenant partitioning, indexing, and cascade delete rules.

-- 1. STORES Table (Multi-tenant)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    shopify_store_id VARCHAR(255),
    shop_domain VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'syncing', 'success', 'failed'
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index organization_id for fast lookup in multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_stores_org_id ON stores(organization_id);

-- 2. PRODUCTS Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_product_id VARCHAR(255) NOT NULL, -- Shopify Product ID
    title VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    category VARCHAR(100),
    vendor VARCHAR(255),
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(12, 2) DEFAULT 0.00,
    inventory_quantity INTEGER NOT NULL DEFAULT 0,
    variant_data JSONB, -- Stores variant parameters, options, weight, bar codes, etc.
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);

-- 3. CUSTOMERS Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_customer_id VARCHAR(255) NOT NULL, -- Shopify Customer ID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    order_count INTEGER DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0.00,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, external_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_org_email ON customers(organization_id, email);

-- 4. ORDERS Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_order_id VARCHAR(255) NOT NULL, -- Shopify Order ID
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    external_customer_id VARCHAR(255),
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    line_items JSONB NOT NULL, -- List of products, quantity, unit price
    financial_status VARCHAR(100), -- 'authorized', 'paid', 'refunded', etc.
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_org_date ON orders(organization_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

-- 5. INVENTORY EVENTS Table
CREATE TABLE IF NOT EXISTS inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'shopify_sync', 'webhook_update', 'pos_checkout', 'manual_adjustment'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_prod ON inventory_events(product_id);

-- 6. WEBHOOK EVENTS Table (Idempotency and Debug Ledger)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(processed) WHERE processed = FALSE;
