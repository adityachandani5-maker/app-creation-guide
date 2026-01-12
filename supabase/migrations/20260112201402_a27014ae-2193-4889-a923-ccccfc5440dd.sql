-- Drop all permissive "Allow all access" policies
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all access to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow all access to sales_log" ON public.sales_log;
DROP POLICY IF EXISTS "Allow all access to payments" ON public.payments;
DROP POLICY IF EXISTS "Allow all access to stock_history" ON public.stock_history;
DROP POLICY IF EXISTS "Allow all access to invoice_uploads" ON public.invoice_uploads;
DROP POLICY IF EXISTS "Allow all access to stock_batches" ON public.stock_batches;

-- Create authenticated-only RLS policies for all tables
CREATE POLICY "Authenticated access to customers" ON public.customers
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to inventory" ON public.inventory
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to sales_log" ON public.sales_log
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to payments" ON public.payments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to stock_history" ON public.stock_history
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to invoice_uploads" ON public.invoice_uploads
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to stock_batches" ON public.stock_batches
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Add database constraints for input validation (using triggers instead of CHECK for compatibility)

-- Create validation trigger function for inventory
CREATE OR REPLACE FUNCTION public.validate_inventory_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock < 0 THEN
    RAISE EXCEPTION 'current_stock cannot be negative';
  END IF;
  IF NEW.purchase_price < 0 THEN
    RAISE EXCEPTION 'purchase_price cannot be negative';
  END IF;
  IF NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'unit_price cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_inventory_before_insert_update
  BEFORE INSERT OR UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_inventory_values();

-- Create validation trigger function for sales_log
CREATE OR REPLACE FUNCTION public.validate_sales_log_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_sold <= 0 THEN
    RAISE EXCEPTION 'quantity_sold must be greater than 0';
  END IF;
  IF NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'unit_price cannot be negative';
  END IF;
  IF NEW.total_price < 0 THEN
    RAISE EXCEPTION 'total_price cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_sales_log_before_insert_update
  BEFORE INSERT OR UPDATE ON public.sales_log
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sales_log_values();

-- Create validation trigger function for payments
CREATE OR REPLACE FUNCTION public.validate_payment_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount_paid <= 0 THEN
    RAISE EXCEPTION 'amount_paid must be greater than 0';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_payments_before_insert_update
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_values();

-- Create validation trigger function for stock_batches
CREATE OR REPLACE FUNCTION public.validate_stock_batch_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than 0';
  END IF;
  IF NEW.remaining_quantity < 0 THEN
    RAISE EXCEPTION 'remaining_quantity cannot be negative';
  END IF;
  IF NEW.remaining_quantity > NEW.quantity THEN
    RAISE EXCEPTION 'remaining_quantity cannot exceed quantity';
  END IF;
  IF NEW.purchase_price < 0 THEN
    RAISE EXCEPTION 'purchase_price cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_stock_batches_before_insert_update
  BEFORE INSERT OR UPDATE ON public.stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_batch_values();