-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  category TEXT,
  hsn_code TEXT,
  current_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  barcode TEXT,
  purchase_price DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sales_log table
CREATE TABLE public.sales_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  invoice_no TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  quantity_sold INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  profit DECIMAL(10,2) DEFAULT 0,
  payment_mode TEXT DEFAULT 'Cash',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create stock_history table for tracking changes
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  product_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  new_balance INTEGER NOT NULL
);

-- Create invoice_uploads table for AI processing
CREATE TABLE public.invoice_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  processed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables (but allow public access for now - no auth required for small shop)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all operations (public access for shop use)
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sales_log" ON public.sales_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to stock_history" ON public.stock_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to invoice_uploads" ON public.invoice_uploads FOR ALL USING (true) WITH CHECK (true);

-- Create function to update customer balance after payment
CREATE OR REPLACE FUNCTION public.update_customer_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.customers 
  SET current_balance = current_balance - NEW.amount_paid,
      updated_at = now()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

-- Create trigger for payment balance updates
CREATE TRIGGER on_payment_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_balance_on_payment();

-- Create function to update stock and customer balance after sale
CREATE OR REPLACE FUNCTION public.update_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Update inventory stock
  UPDATE public.inventory 
  SET current_stock = current_stock - NEW.quantity_sold,
      updated_at = now()
  WHERE id = NEW.product_id;
  
  -- Log stock change
  INSERT INTO public.stock_history (product_id, change_type, amount, new_balance)
  SELECT NEW.product_id, 'SALE', -NEW.quantity_sold, current_stock - NEW.quantity_sold
  FROM public.inventory WHERE id = NEW.product_id;
  
  -- Update customer balance if credit sale
  IF NEW.payment_mode = 'Credit' AND NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers 
    SET current_balance = current_balance + NEW.total_price,
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sale updates
CREATE TRIGGER on_sale_insert
  AFTER INSERT ON public.sales_log
  FOR EACH ROW EXECUTE FUNCTION public.update_on_sale();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();