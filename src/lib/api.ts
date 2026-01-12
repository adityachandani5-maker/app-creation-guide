import { supabase } from "@/integrations/supabase/client";

// Types
export interface Customer {
  id: string;
  name: string;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_name: string;
  category: string | null;
  hsn_code: string | null;
  current_stock: number;
  unit: string;
  barcode: string | null;
  purchase_price: number;
  unit_price: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  date: string;
  invoice_no: string | null;
  customer_id: string | null;
  product_id: string | null;
  quantity_sold: number;
  unit_price: number;
  total_price: number;
  profit: number;
  payment_mode: string;
  created_at: string;
}

export interface Payment {
  id: string;
  date: string;
  customer_id: string | null;
  amount_paid: number;
  created_at: string;
}

// Customers API
export const customersApi = {
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async create(name: string): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async search(query: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10);
    if (error) throw error;
    return data || [];
  }
};

// Inventory API
export const inventoryApi = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('product_name');
    if (error) throw error;
    return data || [];
  },

  async create(product: Omit<Partial<Product>, 'product_name'> & { product_name: string }): Promise<Product> {
    const { data, error } = await supabase
      .from('inventory')
      .insert([product])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async search(query: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .ilike('product_name', `%${query}%`)
      .order('product_name')
      .limit(10);
    if (error) throw error;
    return data || [];
  },

  async findByBarcode(barcode: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async addStock(productId: string, amount: number, purchasePrice?: number): Promise<void> {
    const { data: product, error: fetchError } = await supabase
      .from('inventory')
      .select('current_stock, purchase_price')
      .eq('id', productId)
      .single();
    
    if (fetchError) throw fetchError;

    const newStock = (product?.current_stock || 0) + amount;
    const batchPrice = purchasePrice ?? product?.purchase_price ?? 0;

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ current_stock: newStock })
      .eq('id', productId);
    
    if (updateError) throw updateError;

    // Create FIFO batch
    await supabase.from('stock_batches').insert({
      product_id: productId,
      quantity: amount,
      remaining_quantity: amount,
      purchase_price: batchPrice
    });

    // Log stock change
    await supabase.from('stock_history').insert({
      product_id: productId,
      change_type: 'PURCHASE',
      amount: amount,
      new_balance: newStock
    });
  },

  async consumeStock(productId: string, amount: number): Promise<number> {
    // FIFO: consume from oldest batches first, return weighted cost
    const { data: batches, error: batchError } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('product_id', productId)
      .gt('remaining_quantity', 0)
      .order('created_at', { ascending: true });

    if (batchError) throw batchError;

    let remaining = amount;
    let totalCost = 0;

    for (const batch of batches || []) {
      if (remaining <= 0) break;

      const consume = Math.min(remaining, batch.remaining_quantity);
      totalCost += consume * batch.purchase_price;
      remaining -= consume;

      await supabase
        .from('stock_batches')
        .update({ remaining_quantity: batch.remaining_quantity - consume })
        .eq('id', batch.id);
    }

    return totalCost;
  },

  async subtractStock(productId: string, amount: number): Promise<void> {
    const { data: product, error: fetchError } = await supabase
      .from('inventory')
      .select('current_stock')
      .eq('id', productId)
      .single();
    
    if (fetchError) throw fetchError;

    const newStock = Math.max(0, (product?.current_stock || 0) - amount);

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ current_stock: newStock })
      .eq('id', productId);
    
    if (updateError) throw updateError;

    // Log stock change
    await supabase.from('stock_history').insert({
      product_id: productId,
      change_type: 'SALE',
      amount: -amount,
      new_balance: newStock
    });
  }
};

// Sales API
export const salesApi = {
  async getAll(): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(sale: Omit<Sale, 'id' | 'created_at'>): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales_log')
      .insert(sale)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// Payments API
export const paymentsApi = {
  async getAll(): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payment: { customer_id: string; amount_paid: number; date?: string }): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert(payment)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByCustomer(customerId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};

// Invoice Processing API
export const invoiceApi = {
  async processInvoice(imageBase64: string, existingProducts: Product[]): Promise<any> {
    const { data, error } = await supabase.functions.invoke('process-invoice', {
      body: { imageBase64, existingProducts }
    });
    if (error) throw error;
    return data;
  }
};
