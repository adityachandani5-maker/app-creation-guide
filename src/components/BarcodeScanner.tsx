import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, X, Camera } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScanner = ({ open, onClose, onScan }: BarcodeScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    if (!containerRef.current) return;
    
    setError(null);
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // Ignore scan failures
        }
      );
    } catch (err: any) {
      console.error("Scanner error:", err);
      setError(err?.message || "Failed to access camera. Please allow camera permissions.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <div 
            id="barcode-reader" 
            ref={containerRef}
            className="w-full min-h-[280px] rounded-lg overflow-hidden bg-muted"
          />
          
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-24 border-2 border-primary rounded-lg animate-pulse" />
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted rounded-lg p-4 text-center">
              <Camera className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={startScanner} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Point camera at barcode
        </p>

        <Button variant="outline" onClick={handleClose} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
};