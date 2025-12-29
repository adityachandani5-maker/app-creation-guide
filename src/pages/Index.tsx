import { useState, useEffect } from "react";
import { Plus, Package, AlertTriangle, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi, Product } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    category: "",
    unit: "pcs",
    purchase_price: "",
    unit_price: "",
    low_stock_threshold: "10",
    current_stock: "0"
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await inventoryApi.getAll();
      setProducts(data);
    } catch (error) {
      toast({ title: "Error loading products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.product_name) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }

    try {
      await inventoryApi.create({
        product_name: newProduct.product_name,
        category: newProduct.category || null,
        unit: newProduct.unit,
        purchase_price: parseFloat(newProduct.purchase_price) || 0,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        low_stock_threshold: parseInt(newProduct.low_stock_threshold) || 10,
        current_stock: parseInt(newProduct.current_stock) || 0
      });
      toast({ title: "Product added successfully" });
      setDialogOpen(false);
      setNewProduct({
        product_name: "",
        category: "",
        unit: "pcs",
        purchase_price: "",
        unit_price: "",
        low_stock_threshold: "10",
        current_stock: "0"
      });
      loadProducts();
    } catch (error) {
      toast({ title: "Error adding product", variant: "destructive" });
    }
  };

  const handleEditProduct = async () => {
    if (!editProduct) return;

    try {
      await inventoryApi.update(editProduct.id, {
        product_name: editProduct.product_name,
        category: editProduct.category,
        unit: editProduct.unit,
        purchase_price: editProduct.purchase_price,
        unit_price: editProduct.unit_price,
        low_stock_threshold: editProduct.low_stock_threshold
      });
      toast({ title: "Product updated successfully" });
      setEditDialogOpen(false);
      setEditProduct(null);
      loadProducts();
    } catch (error) {
      toast({ title: "Error updating product", variant: "destructive" });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditProduct({ ...product });
    setEditDialogOpen(true);
  };

  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockProducts = products.filter(p => 
    (p.current_stock || 0) <= (p.low_stock_threshold || 10)
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Stock</h1>
            <p className="text-sm text-muted-foreground">{products.length} products</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={newProduct.product_name}
                    onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      placeholder="e.g. Electronics"
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                      placeholder="e.g. pcs, kg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={newProduct.purchase_price}
                      onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Selling Price</Label>
                    <Input
                      type="number"
                      value={newProduct.unit_price}
                      onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Initial Stock</Label>
                    <Input
                      type="number"
                      value={newProduct.current_stock}
                      onChange={(e) => setNewProduct({ ...newProduct, current_stock: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Low Stock Alert</Label>
                    <Input
                      type="number"
                      value={newProduct.low_stock_threshold}
                      onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                </div>
                <Button onClick={handleAddProduct} className="w-full">
                  Add Product
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">{lowStockProducts.length} products low on stock</span>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{products.length === 0 ? "No products yet. Add your first product!" : "No products found"}</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isLowStock = (product.current_stock || 0) <= (product.low_stock_threshold || 10);
            const isOutOfStock = (product.current_stock || 0) === 0;
            return (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{product.product_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.category || "Uncategorized"} • ₹{product.purchase_price}/{product.unit}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-orange-500' : 'text-foreground'}`}>
                        {product.current_stock || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{product.unit}</p>
                      {isOutOfStock && (
                        <span className="text-xs text-destructive font-medium">Out of stock</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              <div>
                <Label>Product Name</Label>
                <Input
                  value={editProduct.product_name}
                  onChange={(e) => setEditProduct({ ...editProduct, product_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input
                    value={editProduct.category || ""}
                    onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value || null })}
                    placeholder="e.g. Snacks, Drinks"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={editProduct.unit}
                    onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purchase Price</Label>
                  <Input
                    type="number"
                    value={editProduct.purchase_price}
                    onChange={(e) => setEditProduct({ ...editProduct, purchase_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    value={editProduct.unit_price}
                    onChange={(e) => setEditProduct({ ...editProduct, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Low Stock Alert</Label>
                <Input
                  type="number"
                  value={editProduct.low_stock_threshold}
                  onChange={(e) => setEditProduct({ ...editProduct, low_stock_threshold: parseInt(e.target.value) || 10 })}
                />
              </div>
              <Button onClick={handleEditProduct} className="w-full">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Index;
