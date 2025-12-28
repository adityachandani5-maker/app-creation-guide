import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { Product, inventoryApi, invoiceApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ExtractedItem {
  raw_name: string;
  matched_product_id: string | null;
  matched_product_name: string | null;
  confidence: number;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
}

const Invoices = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await inventoryApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be less than 5MB", variant: "destructive" });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setInvoiceImage(base64);
      await processInvoice(base64);
    };
    reader.readAsDataURL(file);
  };

  const processInvoice = async (imageBase64: string) => {
    setIsProcessing(true);
    setExtractedItems([]);

    try {
      const result = await invoiceApi.processInvoice(imageBase64, products);
      
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
        return;
      }

      if (result.items && result.items.length > 0) {
        setExtractedItems(result.items);
        toast({ title: `Found ${result.items.length} items in invoice` });
      } else {
        toast({ title: "No items found in invoice", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error processing invoice:", error);
      toast({ title: error.message || "Error processing invoice", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToStock = async (item: ExtractedItem) => {
    if (!item.matched_product_id) {
      toast({ title: "No matching product found", variant: "destructive" });
      return;
    }

    try {
      await inventoryApi.addStock(item.matched_product_id, item.quantity);
      toast({ title: `Added ${item.quantity} to ${item.matched_product_name}` });
      
      // Remove from list
      setExtractedItems((prev) =>
        prev.filter((i) => i !== item)
      );
      
      // Reload products to show updated stock
      loadProducts();
    } catch (error) {
      toast({ title: "Error updating stock", variant: "destructive" });
    }
  };

  const handleDismissItem = (item: ExtractedItem) => {
    setExtractedItems((prev) => prev.filter((i) => i !== item));
  };

  const handleReset = () => {
    setInvoiceImage(null);
    setExtractedItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice Scanner</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered invoice processing
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Upload Section */}
        {!invoiceImage && (
          <Card className="border-dashed border-2">
            <CardContent className="p-8">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="h-12 w-12" />
                <div className="text-center">
                  <p className="font-medium">Tap to upload invoice</p>
                  <p className="text-sm">Take a photo or select from gallery</p>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Processing State */}
        {isProcessing && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="font-medium">Processing invoice...</p>
              <p className="text-sm text-muted-foreground">
                AI is extracting product information
              </p>
            </CardContent>
          </Card>
        )}

        {/* Invoice Preview */}
        {invoiceImage && !isProcessing && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Invoice Preview</h3>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Scan New
                </Button>
              </div>
              <img
                src={invoiceImage}
                alt="Invoice"
                className="w-full rounded-lg max-h-48 object-contain bg-muted"
              />
            </CardContent>
          </Card>
        )}

        {/* Extracted Items */}
        {extractedItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold px-1">
              Extracted Items ({extractedItems.length})
            </h3>
            
            {extractedItems.map((item, index) => (
              <Card
                key={index}
                className={cn(
                  item.matched_product_id
                    ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                    : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        From invoice: {item.raw_name}
                      </p>
                      {item.matched_product_name ? (
                        <p className="font-semibold text-green-700 dark:text-green-400">
                          → {item.matched_product_name}
                        </p>
                      ) : (
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          No match found
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        item.confidence > 0.7
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          : item.confidence > 0.4
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      )}
                    >
                      {Math.round(item.confidence * 100)}% match
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">Qty: {item.quantity}</span>
                      {item.unit_price && (
                        <span className="text-muted-foreground ml-2">
                          @ ₹{item.unit_price}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDismissItem(item)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {item.matched_product_id && (
                        <Button
                          size="sm"
                          onClick={() => handleAddToStock(item)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Add Stock
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state after processing */}
        {invoiceImage && !isProcessing && extractedItems.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>All items processed</p>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Invoices;
