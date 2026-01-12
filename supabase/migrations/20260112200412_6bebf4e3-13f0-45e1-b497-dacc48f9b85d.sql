-- Create stock_batches table for FIFO tracking
CREATE TABLE public.stock_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;

-- Create policy for access
CREATE POLICY "Allow all access to stock_batches" 
ON public.stock_batches 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_stock_batches_product_id ON public.stock_batches(product_id);
CREATE INDEX idx_stock_batches_remaining ON public.stock_batches(product_id, remaining_quantity) WHERE remaining_quantity > 0;

-- Add comment for documentation
COMMENT ON TABLE public.stock_batches IS 'Tracks individual stock batches for FIFO inventory valuation';