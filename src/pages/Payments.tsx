import { useState, useEffect } from "react";
import { Plus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { SearchInput } from "@/components/SearchInput";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { Customer, Payment, paymentsApi, customersApi } from "@/lib/api";

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [paymentsData, customersData] = await Promise.all([
        paymentsApi.getAll(),
        customersApi.getAll(),
      ]);
      setPayments(paymentsData);
      setCustomers(customersData);
    } catch (error) {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedCustomer) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    try {
      await paymentsApi.create({
        customer_id: selectedCustomer.id,
        amount_paid: amountNum,
      });

      toast({ title: "Payment recorded successfully" });
      setIsAddOpen(false);
      setSelectedCustomer(null);
      setAmount("");
      loadData();
    } catch (error) {
      toast({ title: "Error recording payment", variant: "destructive" });
    }
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return "Unknown";
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "Unknown";
  };

  const filteredPayments = payments.filter((p) => {
    const customerName = getCustomerName(p.customer_id);
    return customerName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground">
              {payments.length} payments received
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
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Customer</Label>
                  <CustomerAutocomplete
                    value={selectedCustomer}
                    onChange={setSelectedCustomer}
                    placeholder="Search customers..."
                  />
                  {selectedCustomer && selectedCustomer.current_balance > 0 && (
                    <p className="text-sm text-destructive mt-1">
                      Outstanding: ₹{selectedCustomer.current_balance.toFixed(2)}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>

                <Button onClick={handleAddPayment} className="w-full">
                  Record Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by customer name..."
        />
      </header>

      {/* Payments List */}
      <main className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No payments recorded</p>
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">
                      {getCustomerName(payment.customer_id)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-bold text-lg text-green-600">
                    +₹{payment.amount_paid}
                  </p>
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

export default Payments;
