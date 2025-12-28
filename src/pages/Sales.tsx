import { useState, useEffect } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { ProductAutocomplete } from "@/components/ProductAutocomplete";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { Product, Customer, Sale, salesApi, customersApi, inventoryApi } from "@/lib/api";

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [salesData, productsData, customersData] = await Promise.all([
        salesApi.getAll(),
        inventoryApi.getAll(),
        customersApi.getAll(),
      ]);
      setSales(salesData);
      setProducts(productsData);
      setCustomers(customersData);
    } catch (error) {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSale = async () => {
    if (!selectedProduct) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    if (quantity <= 0) {
      toast({ title: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }

    if (quantity > selectedProduct.current_stock) {
      toast({ title: "Not enough stock available", variant: "destructive" });
      return;
    }

    if (paymentMode === "Credit" && !selectedCustomer) {
      toast({ title: "Please select a customer for credit sale", variant: "destructive" });
      return;
    }

    try {
      const totalPrice = quantity * selectedProduct.unit_price;
      const profit = quantity * (selectedProduct.unit_price - selectedProduct.purchase_price);

      await salesApi.create({
        date: new Date().toISOString().split('T')[0],
        invoice_no: `INV-${Date.now()}`,
        customer_id: selectedCustomer?.id || null,
        product_id: selectedProduct.id,
        quantity_sold: quantity,
        unit_price: selectedProduct.unit_price,
        total_price: totalPrice,
        profit: profit,
        payment_mode: paymentMode,
      });

      toast({ title: "Sale recorded successfully" });
      setIsAddOpen(false);
      setSelectedProduct(null);
      setSelectedCustomer(null);
      setQuantity(1);
      setPaymentMode("Cash");
      loadData();
    } catch (error) {
      toast({ title: "Error recording sale", variant: "destructive" });
    }
  };

  const handleAddNewCustomer = async (name: string) => {
    try {
      const customer = await customersApi.create(name);
      setSelectedCustomer(customer);
      toast({ title: "Customer added" });
    } catch (error) {
      toast({ title: "Error adding customer", variant: "destructive" });
    }
  };

  const getProductName = (productId: string | null) => {
    const product = products.find((p) => p.id === productId);
    return product?.product_name || "Unknown Product";
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return null;
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales</h1>
            <p className="text-sm text-muted-foreground">
              {sales.length} transactions
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-12 w-12">
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Sale</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Product *</Label>
                  <ProductAutocomplete
                    value={selectedProduct}
                    onChange={setSelectedProduct}
                    placeholder="Search products..."
                  />
                  {selectedProduct && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Price: ₹{selectedProduct.unit_price} | Stock:{" "}
                      {selectedProduct.current_stock}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                </div>

                <div>
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMode === "Credit" && (
                  <div>
                    <Label>Customer *</Label>
                    <CustomerAutocomplete
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      onAddNew={handleAddNewCustomer}
                      placeholder="Search or add customer..."
                    />
                  </div>
                )}

                {selectedProduct && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>₹{(selectedProduct.unit_price * quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 mt-1">
                      <span>Profit:</span>
                      <span>
                        ₹{((selectedProduct.unit_price - selectedProduct.purchase_price) * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <Button onClick={handleAddSale} className="w-full">
                  Record Sale
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Sales List */}
      <main className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sales recorded</p>
          </div>
        ) : (
          sales.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{getProductName(sale.product_id)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {sale.quantity_sold} × ₹{sale.unit_price}
                    </p>
                    {getCustomerName(sale.customer_id) && (
                      <p className="text-sm text-muted-foreground">
                        Customer: {getCustomerName(sale.customer_id)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{sale.total_price}</p>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full">
                      {sale.payment_mode}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(sale.created_at).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Sales;
