import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface PermissionGuardProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export default function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
