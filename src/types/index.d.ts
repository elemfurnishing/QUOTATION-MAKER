export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "employee" | "customer";
  avatar?: string;
  target?: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  tags: string[];
  assignedEmployeeId: string;
  createdAt: string;
  lastContact?: string;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  stock: number;
  description?: string;
}

export interface QuotationItem {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
  customPhoto?: string;
  customTitle?: string;
}

export interface Quotation {
  id: string;
  customerId: string;
  employeeId: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: "draft" | "sent" | "approved" | "rejected";
  versions: QuotationVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationVersion {
  id: string;
  version: number;
  items: QuotationItem[];
  total: number;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean | undefined;
  isLoading?: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}
