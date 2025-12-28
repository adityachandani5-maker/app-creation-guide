import { useState, useEffect, useRef } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Customer, customersApi } from "@/lib/api";

interface CustomerAutocompleteProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  placeholder?: string;
  onAddNew?: (name: string) => void;
}

export function CustomerAutocomplete({ value, onChange, placeholder = "Search customers...", onAddNew }: CustomerAutocompleteProps) {
  const [query, setQuery] = useState(value?.name || "");
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      setQuery(value.name);
    }
  }, [value]);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await customersApi.search(searchQuery);
      setSuggestions(results);
      setIsOpen(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (customer: Customer) => {
    onChange(customer);
    setQuery(customer.name);
    setIsOpen(false);
  };

  const handleAddNew = () => {
    if (onAddNew && query.trim()) {
      onAddNew(query.trim());
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleSelect(customer)}
              className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <div className="font-medium">{customer.name}</div>
              <div className={cn(
                "text-sm",
                customer.current_balance > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                Balance: ₹{customer.current_balance.toFixed(2)}
              </div>
            </button>
          ))}
          
          {onAddNew && query.trim() && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 rounded-none"
              onClick={handleAddNew}
            >
              <Plus className="h-4 w-4" />
              Add "{query.trim()}" as new customer
            </Button>
          )}

          {!onAddNew && query.length > 0 && suggestions.length === 0 && !isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
