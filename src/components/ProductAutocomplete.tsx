import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Product, inventoryApi } from "@/lib/api";

interface ProductAutocompleteProps {
  value: Product | null;
  onChange: (product: Product | null) => void;
  placeholder?: string;
}

export function ProductAutocomplete({ value, onChange, placeholder = "Search products..." }: ProductAutocompleteProps) {
  const [query, setQuery] = useState(value?.product_name || "");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
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
      setQuery(value.product_name);
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
      const results = await inventoryApi.search(searchQuery);
      setSuggestions(results);
      setIsOpen(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (product: Product) => {
    onChange(product);
    setQuery(product.product_name);
    setIsOpen(false);
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
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0",
                product.current_stock <= product.low_stock_threshold && "bg-destructive/10"
              )}
            >
              <div className="font-medium">{product.product_name}</div>
              <div className="text-sm text-muted-foreground flex justify-between">
                <span>Stock: {product.current_stock} {product.unit}</span>
                <span>₹{product.unit_price}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length > 0 && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          No products found
        </div>
      )}
    </div>
  );
}
