import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Check, X, Loader2, Plus, ShoppingCart, AlertTriangle, Link, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Product, Customer, inventoryApi, invoiceApi, customersApi, salesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ExtractedItem {
  raw_name: string;
  matched_product_id: string | null;
  matched_product_name: string | null;
  confidence: number;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
}

// Simple hash function for duplicate detection
const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
};

const Invoices = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Manual sale state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customPrice, setCustomPrice] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Sales history
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Barcode scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newProductItem, setNewProductItem] = useState<ExtractedItem | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPurchasePrice, setNewProductPurchasePrice] = useState("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, customersData, salesData] = await Promise.all([
        inventoryApi.getAll(),
        customersApi.getAll(),
        salesApi.getAll()
      ]);
      setProducts(productsData);
      setCustomers(customersData);
      setSales(salesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setSalesLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isPdf) {
      toast({ title: "Please select an image or PDF file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File must be less than 10MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setInvoiceImage(base64);
      setDuplicateWarning(null);
      
      // Check for duplicate invoice
      const fileHash = await hashString(base64.substring(0, 10000)); // Hash first 10k chars for speed
      const { data: existing } = await supabase
        .from('invoice_uploads')
        .select('id, file_name, created_at')
        .eq('file_url', fileHash)
        .maybeSingle();
      
      if (existing) {
        setDuplicateWarning(`This invoice was already uploaded on ${new Date(existing.created_at).toLocaleDateString()}`);
      }
      
      await processInvoice(base64, fileHash);
    };
    reader.readAsDataURL(file);
  };

  const processInvoice = async (imageBase64: string, fileHash?: string) => {
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
        
        // Save invoice record with hash for duplicate detection
        if (fileHash) {
          await supabase.from('invoice_uploads').insert({
            file_name: `invoice_${Date.now()}`,
            file_url: fileHash,
            status: 'processed',
            processed_data: result
          });
        }
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

  // Handle manual product association for unmatched items
  const handleAssociateProduct = (item: ExtractedItem, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setExtractedItems(prev => prev.map(i => 
      i === item 
        ? { ...i, matched_product_id: productId, matched_product_name: product.product_name, confidence: 1.0 }
        : i
    ));
    toast({ title: `Linked "${item.raw_name}" to ${product.product_name}` });
  };

  // Open new product dialog with pre-filled data from invoice
  const handleOpenNewProduct = (item: ExtractedItem) => {
    setNewProductItem(item);
    setNewProductName(item.raw_name);
    setNewProductPurchasePrice(item.unit_price?.toString() || "");
    setNewProductSellingPrice("");
    setNewProductQuantity(item.quantity.toString());
    setNewProductDialogOpen(true);
  };

  // Create new product from invoice item
  const handleCreateNewProduct = async () => {
    if (!newProductName.trim()) {
      toast({ title: "Please enter product name", variant: "destructive" });
      return;
    }
    if (!newProductPurchasePrice || parseFloat(newProductPurchasePrice) <= 0) {
      toast({ title: "Please enter valid purchase price", variant: "destructive" });
      return;
    }
    if (!newProductQuantity || parseInt(newProductQuantity) <= 0) {
      toast({ title: "Please enter valid quantity", variant: "destructive" });
      return;
    }

    try {
      const newProduct = await inventoryApi.create({
        product_name: newProductName.trim(),
        purchase_price: parseFloat(newProductPurchasePrice),
        unit_price: parseFloat(newProductSellingPrice) || parseFloat(newProductPurchasePrice) * 1.2, // Default 20% markup
        current_stock: parseInt(newProductQuantity),
        unit: "pcs"
      });

      // Update the extracted item with the new product
      if (newProductItem) {
        setExtractedItems(prev => prev.map(i => 
          i === newProductItem 
            ? { ...i, matched_product_id: newProduct.id, matched_product_name: newProduct.product_name, confidence: 1.0 }
            : i
        ));
      }

      setProducts(prev => [...prev, newProduct]);
      toast({ title: `Created "${newProduct.product_name}" with ${newProductQuantity} in stock` });
      setNewProductDialogOpen(false);
      resetNewProductForm();
    } catch (error) {
      toast({ title: "Error creating product", variant: "destructive" });
    }
  };

  const resetNewProductForm = () => {
    setNewProductItem(null);
    setNewProductName("");
    setNewProductPurchasePrice("");
    setNewProductSellingPrice("");
    setNewProductQuantity("");
  };

  const handleSubtractStock = async (item: ExtractedItem) => {
    if (!item.matched_product_id) {
      toast({ title: "No matching product found", variant: "destructive" });
      return;
    }

    try {
      await inventoryApi.subtractStock(item.matched_product_id, item.quantity);
      toast({ title: `Sold ${item.quantity} of ${item.matched_product_name}` });
      
      setExtractedItems((prev) => prev.filter((i) => i !== item));
      loadData();
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
    setDuplicateWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualSale = async () => {
    if (!selectedProductId) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    if (paymentMode === "Credit" && !selectedCustomer) {
      toast({ title: "Please select a customer for credit sale", variant: "destructive" });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if ((product.current_stock || 0) < qty) {
      toast({ title: "Insufficient stock", variant: "destructive" });
      return;
    }

    try {
      const sellingPrice = customPrice ? parseFloat(customPrice) : product.unit_price;
      const totalPrice = sellingPrice * qty;
      const profit = (sellingPrice - product.purchase_price) * qty;

      await salesApi.create({
        product_id: selectedProductId,
        customer_id: paymentMode === "Credit" ? selectedCustomer?.id || null : null,
        quantity_sold: qty,
        unit_price: sellingPrice,
        total_price: totalPrice,
        profit: profit,
        payment_mode: paymentMode,
        date: new Date().toISOString().split('T')[0],
        invoice_no: null
      });

      toast({ title: `Sold ${qty} x ${product.product_name}` });
      setManualDialogOpen(false);
      resetManualForm();
      loadData();
    } catch (error) {
      toast({ title: "Error recording sale", variant: "destructive" });
    }
  };

  const resetManualForm = () => {
    setSelectedProductId("");
    setQuantity("1");
    setCustomPrice("");
    setPaymentMode("Cash");
    setSelectedCustomer(null);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const sellingPrice = customPrice ? parseFloat(customPrice) : (selectedProduct?.unit_price || 0);
  const subtotal = sellingPrice * (parseInt(quantity) || 0);

  const getProductName = (productId: string | null) => {
    if (!productId) return "Unknown";
    return products.find(p => p.id === productId)?.product_name || "Unknown";
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId)?.name || null;
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const product = await inventoryApi.findByBarcode(barcode);
      if (product) {
        setSelectedProductId(product.id);
        setManualDialogOpen(true);
        toast({ title: `Found: ${product.product_name}` });
      } else {
        toast({ 
          title: "Product not found", 
          description: `No product with barcode: ${barcode}`,
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ title: "Error looking up barcode", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales</h1>
            <p className="text-sm text-muted-foreground">
              Record sales and subtract from stock
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              size="icon" 
              variant="outline"
              onClick={() => setIsScannerOpen(true)}
            >
              <ScanLine className="h-4 w-4" />
            </Button>
            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Manual Sale
                </Button>
              </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Manual Sale</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Product *</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {products.filter(p => (p.current_stock || 0) > 0).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex justify-between items-center w-full gap-4">
                            <span>{product.product_name}</span>
                            <span className="text-muted-foreground text-sm">
                              Stock: {product.current_stock} • ₹{product.unit_price}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedProduct?.current_stock || 999}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: {selectedProduct.current_stock} {selectedProduct.unit}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Selling Price (₹)</Label>
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={selectedProduct ? `Default: ₹${selectedProduct.unit_price}` : "Select product first"}
                  />
                  {selectedProduct && !customPrice && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to use default price
                    </p>
                  )}
                </div>

                <div>
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Credit">Credit (Udhaar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMode === "Credit" && (
                  <div>
                    <Label>Customer *</Label>
                    <CustomerAutocomplete
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      placeholder="Search or add customer..."
                      onAddNew={async (name) => {
                        try {
                          const newCustomer = await customersApi.create(name);
                          setSelectedCustomer(newCustomer);
                          setCustomers(prev => [...prev, newCustomer]);
                          toast({ title: `Created customer: ${name}` });
                        } catch (error) {
                          toast({ title: "Error creating customer", variant: "destructive" });
                        }
                      }}
                    />
                    {selectedCustomer && selectedCustomer.current_balance > 0 && (
                      <p className="text-sm text-destructive mt-1">
                        Outstanding: ₹{selectedCustomer.current_balance.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {selectedProduct && parseInt(quantity) > 0 && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Unit Price:</span>
                        <span className={customPrice ? "line-through text-muted-foreground" : ""}>
                          ₹{selectedProduct.unit_price}
                        </span>
                        {customPrice && (
                          <span className="text-primary font-medium">₹{customPrice}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Quantity:</span>
                        <span>{quantity}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span>₹{subtotal.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button onClick={handleManualSale} className="w-full">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Confirm Sale
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <BarcodeScanner 
          open={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleBarcodeScan} 
        />
      </header>

      <main className="p-4 space-y-4">
        <Tabs defaultValue="scan" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">Scan Invoice</TabsTrigger>
            <TabsTrigger value="history">Recent Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="space-y-4 mt-4">
            {/* Upload Section */}
            {!invoiceImage && (
              <Card className="border-dashed border-2">
                <CardContent className="p-8">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
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
                      <p className="text-sm">Image or PDF (max 10MB)</p>
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

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Possible Duplicate</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">{duplicateWarning}</p>
                  </div>
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
                  {invoiceImage.startsWith("data:application/pdf") ? (
                    <div className="w-full rounded-lg p-8 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2" />
                      <p className="text-sm">PDF uploaded</p>
                    </div>
                  ) : (
                    <img
                      src={invoiceImage}
                      alt="Invoice"
                      className="w-full rounded-lg max-h-48 object-contain bg-muted"
                    />
                  )}
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
                          {item.matched_product_id ? (
                            <Button
                              size="sm"
                              onClick={() => handleSubtractStock(item)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Confirm Sale
                            </Button>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenNewProduct(item)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                New
                              </Button>
                              <Select onValueChange={(value) => handleAssociateProduct(item, value)}>
                                <SelectTrigger className="w-[100px] h-8 bg-background">
                                  <SelectValue placeholder="Link" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      <span className="truncate">{product.product_name}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
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
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {salesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : sales.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sales recorded yet</p>
                </CardContent>
              </Card>
            ) : (
              sales.map((sale) => {
                const customerName = getCustomerName(sale.customer_id);
                return (
                  <Card key={sale.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{getProductName(sale.product_id)}</p>
                          <p className="text-sm text-muted-foreground">
                            {sale.quantity_sold} × ₹{sale.unit_price}
                            {customerName && <span className="ml-2">• {customerName}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(sale.created_at).toLocaleString()} • {sale.payment_mode}
                          </p>
                        </div>
                        <p className="font-bold text-lg">₹{sale.total_price}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />

      {/* New Product from Invoice Dialog */}
      <Dialog open={newProductDialogOpen} onOpenChange={(open) => {
        setNewProductDialogOpen(open);
        if (!open) resetNewProductForm();
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Product name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Detected from invoice: "{newProductItem?.raw_name}"
              </p>
            </div>

            <div>
              <Label>Purchase Price (₹) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newProductPurchasePrice}
                onChange={(e) => setNewProductPurchasePrice(e.target.value)}
                placeholder="Cost per unit"
              />
            </div>

            <div>
              <Label>Selling Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newProductSellingPrice}
                onChange={(e) => setNewProductSellingPrice(e.target.value)}
                placeholder="Leave empty for 20% markup"
              />
              {!newProductSellingPrice && newProductPurchasePrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  Default: ₹{(parseFloat(newProductPurchasePrice) * 1.2).toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <Label>Quantity Purchased *</Label>
              <Input
                type="number"
                min="1"
                value={newProductQuantity}
                onChange={(e) => setNewProductQuantity(e.target.value)}
                placeholder="How many units bought"
              />
            </div>

            {newProductPurchasePrice && newProductQuantity && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Unit Cost:</span>
                    <span>₹{parseFloat(newProductPurchasePrice).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Quantity:</span>
                    <span>{newProductQuantity}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Total Purchase:</span>
                    <span>₹{(parseFloat(newProductPurchasePrice) * parseInt(newProductQuantity)).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleCreateNewProduct} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Product & Add to Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
