import { Link, useLocation } from "react-router-dom";
import { Package, Users, CreditCard, FileText, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Package, label: "Stock" },
  { to: "/purchases", icon: PackagePlus, label: "Purchase" },
  { to: "/invoices", icon: FileText, label: "Sales" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/payments", icon: CreditCard, label: "Payments" },
];

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
