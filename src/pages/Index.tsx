import { useState } from "react";
import { Plus, Package, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";

// Mock data for preview
const mockProducts = [
  { id: "1", product_name: "Samsung Galaxy A54", category: "Electronics", current_stock: 12, unit: "pcs", unit_price: 32999, low_stock_threshold: 5 },
  { id: "2", product_name: "iPhone 15 Pro Max", category: "Electronics", current_stock: 3, unit: "pcs", unit_price: 159900, low_stock_threshold: 5 },
  { id: "3", product_name: "Wireless Earbuds", category: "Accessories", current_stock: 45, unit: "pcs", unit_price: 2499, low_stock_threshold: 10 },
  { id: "4", product_name: "USB-C Cable 1m", category: "Accessories", current_stock: 2, unit: "pcs", unit_price: 299, low_stock_threshold: 20 },
  { id: "5", product_name: "Screen Protector", category: "Accessories", current_stock: 78, unit: "pcs", unit_price: 199, low_stock_threshold: 15 },
  { id: "6", product_name: "Phone Case - Clear", category: "Accessories", current_stock: 34, unit: "pcs", unit_price: 499, low_stock_threshold: 10 },
  { id: "7", product_name: "Power Bank 10000mAh", category: "Electronics", current_stock: 8, unit: "pcs", unit_price: 1299, low_stock_threshold: 5 },
  { id: "8", product_name: "Laptop Stand", category: "Accessories", current_stock: 0, unit: "pcs", unit_price: 1499, low_stock_threshold: 3 },
];

const Index = () => {
  const [search, setSearch] = useState("");

  const filteredProducts = mockProducts.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockProducts = mockProducts.filter(p => 
    p.current_stock <= p.low_stock_threshold
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Stock</h1>
            <p className="text-sm text-muted-foreground">{mockProducts.length} products</p>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Product
          </Button>
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
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No products found</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isLowStock = product.current_stock <= product.low_stock_threshold;
            const isOutOfStock = product.current_stock === 0;
            return (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{product.product_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.category} • ₹{product.unit_price.toLocaleString()}/{product.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-orange-500' : 'text-foreground'}`}>
                      {product.current_stock}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.unit}</p>
                    {isOutOfStock && (
                      <span className="text-xs text-destructive font-medium">Out of stock</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
