import { useState, useEffect } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { SearchInput } from "@/components/SearchInput";
import { Customer, customersApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (error) {
      toast({ title: "Error loading customers", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }

    try {
      await customersApi.create(newName.trim());
      toast({ title: "Customer added successfully" });
      setIsAddOpen(false);
      setNewName("");
      loadCustomers();
    } catch (error) {
      toast({ title: "Error adding customer", variant: "destructive" });
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = customers.reduce(
    (sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0),
    0
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Customers</h1>
            <p className="text-sm text-muted-foreground">
              {customers.length} customers
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-12 w-12">
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter customer name"
                    autoFocus
                  />
                </div>
                <Button onClick={handleAddCustomer} className="w-full">
                  Add Customer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search customers..."
        />

        {totalOutstanding > 0 && (
          <div className="mt-3 bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-sm">
            Total Outstanding: ₹{totalOutstanding.toFixed(2)}
          </div>
        )}
      </header>

      {/* Customer List */}
      <main className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Customer since{" "}
                      {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-bold text-lg",
                        customer.current_balance > 0
                          ? "text-destructive"
                          : customer.current_balance < 0
                          ? "text-green-600"
                          : "text-muted-foreground"
                      )}
                    >
                      {customer.current_balance > 0
                        ? `₹${customer.current_balance.toFixed(2)}`
                        : customer.current_balance < 0
                        ? `₹${Math.abs(customer.current_balance).toFixed(2)} CR`
                        : "₹0.00"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {customer.current_balance > 0
                        ? "Outstanding"
                        : customer.current_balance < 0
                        ? "Advance"
                        : "Settled"}
                    </p>
                  </div>
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

export default Customers;
