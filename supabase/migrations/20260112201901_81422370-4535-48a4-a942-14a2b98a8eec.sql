-- Fix SECURITY DEFINER functions by adding input validation

-- Update update_customer_balance_on_payment with validation
CREATE OR REPLACE FUNCTION public.update_customer_balance_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate input: amount_paid must be positive
  IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount: amount_paid must be greater than 0';
  END IF;
  
  -- Validate input: customer_id must exist
  IF NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payment: customer_id is required';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
    RAISE EXCEPTION 'Invalid payment: customer does not exist';
  END IF;
  
  -- Perform the update
  UPDATE public.customers 
  SET current_balance = current_balance - NEW.amount_paid,
      updated_at = now()
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$function$;

-- Update update_on_sale with validation  
CREATE OR REPLACE FUNCTION public.update_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate input: quantity_sold must be positive
  IF NEW.quantity_sold IS NULL OR NEW.quantity_sold <= 0 THEN
    RAISE EXCEPTION 'Invalid sale: quantity_sold must be greater than 0';
  END IF;
  
  -- Validate input: prices must be non-negative
  IF NEW.unit_price IS NULL OR NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'Invalid sale: unit_price cannot be negative';
  END IF;
  
  IF NEW.total_price IS NULL OR NEW.total_price < 0 THEN
    RAISE EXCEPTION 'Invalid sale: total_price cannot be negative';
  END IF;
  
  -- Validate input: product_id must exist
  IF NEW.product_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = NEW.product_id) THEN
      RAISE EXCEPTION 'Invalid sale: product does not exist';
    END IF;
  END IF;
  
  -- Validate input: customer_id must exist if provided
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
      RAISE EXCEPTION 'Invalid sale: customer does not exist';
    END IF;
  END IF;

  -- Update inventory stock
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.inventory 
    SET current_stock = current_stock - NEW.quantity_sold,
        updated_at = now()
    WHERE id = NEW.product_id;
    
    -- Log stock change
    INSERT INTO public.stock_history (product_id, change_type, amount, new_balance)
    SELECT NEW.product_id, 'SALE', -NEW.quantity_sold, current_stock - NEW.quantity_sold
    FROM public.inventory WHERE id = NEW.product_id;
  END IF;
  
  -- Update customer balance if credit sale
  IF NEW.payment_mode = 'Credit' AND NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers 
    SET current_balance = current_balance + NEW.total_price,
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;