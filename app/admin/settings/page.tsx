"use client";

import { useState, useEffect } from "react";
import { Plus, Search, X, User, Lock, Shield, CheckSquare, Save, Trash2, Edit3 } from "lucide-react";

/**
 * ------------------------------------------------------------------
 *                          CONSTANTS
 * ------------------------------------------------------------------
 */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
const LOGIN_SHEET_NAME = "Login"; // Target Sheet
const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";

interface LoginUser {
  userName: string; // Col A
  userID: string;   // Col B
  password: string; // Col C
  role: string;     // Col D
  pages: string[];  // Col E (comma separated)
  rowIndex: number; // For updates/deletes
}

/**
 * ------------------------------------------------------------------
 *                          MAIN COMPONENT
 * ------------------------------------------------------------------
 */
export default function SettingsPage() {
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [allPages, setAllPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<LoginUser | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    userName: "",
    userID: "",
    password: "",
    role: "User",
    selectedPages: [] as string[],
  });

  /**
   * ------------------------------------------------------------------
   *                          FETCH DATA
   * ------------------------------------------------------------------
   */
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${LOGIN_SHEET_NAME}`);
      const json = await response.json();
      
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(1); // Skip header (Row 1)
        
        // --- 1. Extract Users (Cols A-E) ---
        const loadedUsers: LoginUser[] = rows.map((row: any[], i: number) => ({
          userName: String(row[0] || ""),
          userID: String(row[1] || ""),
          password: String(row[2] || ""),
          role: String(row[3] || ""),
          pages: String(row[4] || "").split(",").map(p => p.trim()).filter(Boolean),
          rowIndex: i + 2 // 1-based index, +header
        })).filter(u => u.userID); // Must have ID

        setUsers(loadedUsers);

        // --- 2. Extract Available Pages (Col F) ---
        // We scan Column F (Index 5) from all rows to get the unique list of "Page Names"
        // User request: "Pages show Check Box get data forom "Login" page Column 'F2:F" "Page Name""
        const pagesSet = new Set<string>();
        rows.forEach((row: any[]) => {
          const pageName = String(row[5] || "").trim();
          if (pageName) pagesSet.add(pageName);
        });
        setAllPages(Array.from(pagesSet));
      }
    } catch (error) {
      console.error("Failed to fetch settings data:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ------------------------------------------------------------------
   *                          HANDLERS
   * ------------------------------------------------------------------
   */
  const handleOpenModal = (user: LoginUser | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        userName: user.userName,
        userID: user.userID,
        password: user.password,
        role: user.role,
        selectedPages: user.pages,
      });
    } else {
      setEditingUser(null);
      setFormData({
        userName: "",
        userID: "",
        password: "",
        role: "User",
        selectedPages: [],
      });
    }
    setIsModalOpen(true);
  };

  const togglePageSelection = (page: string) => {
    setFormData(prev => {
      if (prev.selectedPages.includes(page)) {
        return { ...prev, selectedPages: prev.selectedPages.filter(p => p !== page) };
      } else {
        return { ...prev, selectedPages: [...prev.selectedPages, page] };
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userName || !formData.userID || !formData.password) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const pageString = formData.selectedPages.join(", ");
      const rowToSave = [
        formData.userName,
        formData.userID,
        formData.password,
        formData.role,
        pageString
      ];

      const params = new URLSearchParams();

      if (editingUser) {
        // Update existing row
        // We'll update cell by cell or rewrite the row. 
        // For simplicity with the provided script API usually 'updateRow' isn't standard, 
        // using 'updateCell' is safer if API supports it, BUT the API seems generic.
        // Let's assume we use 'updateCell' for each or if there's an 'updateRow' action.
        // Given complexity, updateCell loop is reliable.
        
        // Actually, let's use a simpler approach if the script supports it, but since I don't see `updateRow` documentation,
        // I will use `updateCell` loop which I've seen in other files.
        const rIndex = editingUser.rowIndex;
        // Cols: A=1, B=2, C=3, D=4, E=5
        await updateCell(rIndex, 1, formData.userName);
        await updateCell(rIndex, 2, formData.userID);
        await updateCell(rIndex, 3, formData.password);
        await updateCell(rIndex, 4, formData.role);
        await updateCell(rIndex, 5, pageString);
      } else {
        // Insert new row
        // Note: The script likely appends. But wait, Col F also has data. 
        // If we append blindly, we might desync if Col F is treated as a separate table. 
        // The user says Col F has page names. Assuming standard row addition is fine.
        
        // However, `appendQuotationLogRow` uses `insert`. Let's try to find an `append` or `insert` action.
        // The existing code uses action="insert" with `rowData`.
        // We need to be careful not to overwrite Col F datum if the script appends a full row.
        // Usually `appendRow` in AppScript adds to A,B,C... and leaves others empty if not specified.
        params.append("action", "insert");
        params.append("sheetName", LOGIN_SHEET_NAME);
        params.append("rowData", JSON.stringify(rowToSave)); // Pass array
        
        await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
      }

      await fetchData(); // Refresh
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCell = async (rowIndex: number, colIndex: number, value: string) => {
    const params = new URLSearchParams();
    params.append("action", "updateCell");
    params.append("sheetName", LOGIN_SHEET_NAME);
    params.append("rowIndex", String(rowIndex));
    params.append("columnIndex", String(colIndex));
    params.append("value", value);

    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  };

  // Filter users
  const filteredUsers = users.filter(u => 
    u.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.userID.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * ------------------------------------------------------------------
   *                          UI RENDER
   * ------------------------------------------------------------------
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Settings</h1>
            <p className="text-gray-500 text-sm mt-1">Manage users, roles, and permissions</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-lg flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New User
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 backdrop-blur"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["User Name", "User ID", "Password", "Role", "Allowed Pages", "Actions"].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.userID} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{user.userName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{user.userID}</td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">••••••</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.role.toLowerCase() === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {user.pages.map(p => (
                            <span key={p} className="bg-gray-100 px-2 py-0.5 rounded text-xs border border-gray-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.userName}
                        onChange={e => setFormData({...formData, userName: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User ID</label>
                     <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                         value={formData.userID}
                         onChange={e => setFormData({...formData, userID: e.target.value})}
                         className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                         placeholder="john.doe"
                         required
                       />
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="Secret123"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                    >
                      <option value="Admin">Admin</option>
                      <option value="User">User</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Access Pages</label>
                  <div className="grid grid-cols-2 gap-3">
                    {allPages.length > 0 ? allPages.map(page => (
                      <label key={page} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        formData.selectedPages.includes(page) 
                          ? "bg-blue-50 border-blue-200" 
                          : "bg-white border-gray-100 hover:border-gray-200"
                      }`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                          formData.selectedPages.includes(page)
                             ? "bg-blue-600 border-blue-600"
                             : "bg-white border-gray-300"
                        }`}>
                          {formData.selectedPages.includes(page) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${
                          formData.selectedPages.includes(page) ? "text-blue-800" : "text-gray-600"
                        }`}>
                          {page}
                        </span>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={formData.selectedPages.includes(page)}
                          onChange={() => togglePageSelection(page)}
                        />
                      </label>
                    )) : (
                      <p className="text-sm text-gray-500 col-span-2">No pages found in column F.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <Save className="w-5 h-5" /> Save User
                        </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
