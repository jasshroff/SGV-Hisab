import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { PageHeader } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/context/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  const load = async () => {
    const r = await api.get("/admin/users");
    setUsers(r.data);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    try { await api.put(`/admin/users/${u.id}`, { active: !u.active }); toast.success("Updated"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const changeRole = async (u, role) => {
    try { await api.put(`/admin/users/${u.id}`, { role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto" data-testid="admin-page">
      <PageHeader title="Admin · Users" hindi="व्यवस्थापक" subtitle="Manage users and access" />

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
        <table className="w-full ledger-table" data-testid="admin-users-table">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Email</th>
              <th className="text-left">Role</th>
              <th className="text-left">Active</th>
              <th className="text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-muted-foreground">{u.email}</td>
                <td>
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={u.id === user.id}>
                    <SelectTrigger className="h-8 w-32" data-testid={`role-select-${u.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td>
                  <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} disabled={u.id === user.id} data-testid={`active-switch-${u.id}`} />
                </td>
                <td className="text-muted-foreground">{u.created_at ? format(parseISO(u.created_at), "dd MMM yyyy") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
