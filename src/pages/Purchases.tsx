import { useState } from "react";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { ProductAutocomplete } from "@/components/ProductAutocomplete";
import { Product, inventoryApi } from "@/lib/api";

interface PurchaseEntry {
  id: string;
  productName: string;
  quantity: number;
  timestamp: Date;
}

const Purchases = () => {
  const [recentPurchases, setRecentPurchases] = useState<PurchaseEntry[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // New product form state
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    category: "",
    unit: "pcs",
    purchase_price: "",
    unit_price: "",
    initial_stock: ""
  });

  const handleAddPurchase = async () => {
    if (!selectedProduct) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await inventoryApi.addStock(selectedProduct.id, qty);
      
      const entry: PurchaseEntry = {
        id: crypto.randomUUID(),
        productName: selectedProduct.product_name,
        quantity: qty,
        timestamp: new Date(),
      };
      setRecentPurchases((prev) => [entry, ...prev]);

      toast({ title: `Added ${qty} ${selectedProduct.unit} of ${selectedProduct.product_name}` });
      
      setSelectedProduct(null);
      setQuantity("");
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "Error adding stock", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewProduct = async () => {
    if (!newProduct.product_name) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }

    const initialStock = parseInt(newProduct.initial_stock) || 0;
    if (initialStock <= 0) {
      toast({ title: "Please enter initial stock quantity", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await inventoryApi.create({
        product_name: newProduct.product_name,
        category: newProduct.category || null,
        unit: newProduct.unit || "pcs",
        purchase_price: parseFloat(newProduct.purchase_price) || 0,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        current_stock: initialStock,
        low_stock_threshold: 10
      });

      const entry: PurchaseEntry = {
        id: crypto.randomUUID(),
        productName: created.product_name,
        quantity: initialStock,
        timestamp: new Date(),
      };
      setRecentPurchases((prev) => [entry, ...prev]);

      toast({ title: `Created ${created.product_name} with ${initialStock} ${created.unit}` });
      
      setNewProduct({
        product_name: "",
        category: "",
        unit: "pcs",
        purchase_price: "",
        unit_price: "",
        initial_stock: ""
      });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "Error creating product", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Purchases</h1>
            <p className="text-sm text-muted-foreground">
              Add stock to inventory
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Purchase</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="existing" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Product</TabsTrigger>
                  <TabsTrigger value="new">New Product</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <ProductAutocomplete
                      value={selectedProduct}
                      onChange={setSelectedProduct}
                      placeholder="Search existing products..."
                    />
                  </div>

                  {selectedProduct && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-sm">
                        <div className="flex justify-between">
                          <span>Current Stock:</span>
                          <span className="font-medium">
                            {selectedProduct.current_stock} {selectedProduct.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Purchase Price:</span>
                          <span className="font-medium">₹{selectedProduct.purchase_price}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label>Quantity to Add</Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      min="1"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleAddPurchase}
                    disabled={!selectedProduct || !quantity || isSubmitting}
                  >
                    {isSubmitting ? "Adding..." : "Add to Stock"}
                  </Button>
                </TabsContent>

                <TabsContent value="new" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input
                      value={newProduct.product_name}
                      onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                      placeholder="e.g. Coke 500ml"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        placeholder="e.g. Beverages"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                        placeholder="pcs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Purchase Price</Label>
                      <Input
                        type="number"
                        value={newProduct.purchase_price}
                        onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                        placeholder="₹0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Selling Price</Label>
                      <Input
                        type="number"
                        value={newProduct.unit_price}
                        onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })}
                        placeholder="₹0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Initial Stock Quantity *</Label>
                    <Input
                      type="number"
                      value={newProduct.initial_stock}
                      onChange={(e) => setNewProduct({ ...newProduct, initial_stock: e.target.value })}
                      placeholder="How many are you adding?"
                      min="1"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCreateNewProduct}
                    disabled={!newProduct.product_name || !newProduct.initial_stock || isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Create & Add Stock"}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Recent Purchases */}
        {recentPurchases.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold px-1">Recent Additions</h3>
            {recentPurchases.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{entry.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        +{entry.quantity} added
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {recentPurchases.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No recent purchases</p>
              <p className="text-sm">Add stock to existing or new products</p>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Purchases;
