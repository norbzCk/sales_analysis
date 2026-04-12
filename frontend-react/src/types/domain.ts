export interface Product {
  id: number;
  name: string;
  category?: string;
  price?: number;
  stock?: number;
  description?: string;
  in_stock?: boolean;
  image_url?: string;
  seller_id?: number | null;
  is_active?: boolean;
  provider_id?: number | null;
  provider?: Provider | null;
  rating_avg?: number;
  rating_count?: number;
}

export interface Provider {
  id: number;
  name: string;
  location?: string;
  email?: string | null;
  phone?: string | null;
  verified?: boolean;
  response_time?: string;
  min_order_qty?: string;
  description?: string;
  rating_avg?: number;
  rating_count?: number;
  total_sales?: number;
  total_products?: number;
}

export interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  total_units: number;
  top_product: string;
}

export interface InventoryStats {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_value: number;
  alerts: Array<{
    product_id: number;
    product_name: string;
    current_stock: number;
    low_stock_threshold: number;
    provider_id?: number | null;
    provider_name?: string | null;
  }>;
}

export interface Order {
  id: number;
  order_date?: string | null;
  product?: string | null;
  category?: string | null;
  provider_id?: number | null;
  provider_name?: string | null;
  seller_id?: number | null;
  quantity?: number;
  unit_price?: number;
  total?: number;
  status?: string | null;
  status_reason?: string | null;
  rating?: number | null;
  created_by?: number | string | null;
  product_id?: number | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  delivery_notes?: string | null;
  delivery_method?: string | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  instructions?: string | null;
}

export interface PaymentHistoryItem {
  transaction_id: string;
  order_id: number;
  product?: string | null;
  amount: number;
  status: string;
  date?: string | null;
}

export interface PaymentResponse {
  transaction_id: string;
  status: string;
  amount: number;
  message: string;
  timestamp?: string;
  instructions?: string | null;
}

export interface Sale {
  id: number;
  date?: string | null;
  product?: string | null;
  category?: string | null;
  quantity?: number;
  unit_price?: number;
  revenue?: number;
  status?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface LogisticsDelivery {
  id: number;
  order_id?: number | null;
  pickup_location: string;
  delivery_location: string;
  status: string;
  price?: number | null;
  special_instructions?: string | null;
  verification_code?: string | null;
  created_at?: string | null;
  picked_at?: string | null;
  delivered_at?: string | null;
}

export interface BusinessProfile {
  id: number;
  business_name: string;
  owner_name: string;
  phone: string;
  email?: string | null;
  business_type?: string | null;
  category?: string | null;
  description?: string | null;
  region?: string | null;
  area?: string | null;
  street?: string | null;
  shop_number?: string | null;
  operating_hours?: string | null;
  shop_logo_url?: string | null;
  shop_images?: string | null;
  verification_status?: string | null;
}

export interface SellerDashboardOverview {
  business: BusinessProfile;
  summary: {
    revenue_today: number;
    revenue_week: number;
    revenue_month: number;
    revenue_total: number;
    orders_total: number;
    orders_pending: number;
    orders_completed: number;
    orders_cancelled: number;
    ongoing_deliveries: number;
    completed_deliveries: number;
    inventory_low_stock: number;
    inventory_out_of_stock: number;
  };
  top_products: Array<{
    product: string;
    units: number;
    revenue: number;
  }>;
  inventory: {
    total_products: number;
    total_value: number;
    out_of_stock: number;
    low_stock: number;
    alerts: Array<{
      product_id: number;
      product_name: string;
      current_stock: number;
      low_stock_threshold: number;
    }>;
  };
}
