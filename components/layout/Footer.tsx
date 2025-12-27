"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  
  // Hide footer on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-sm text-muted-foreground border-t bg-background/80 backdrop-blur-sm">
      <p>Powered by <span className="font-medium">Botivate</span></p>
    </footer>
  );
}
