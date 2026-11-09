import {
  Bell,
  ClipboardList,
  FileText,
  Inbox,
  Package,
  Palette,
  Receipt,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import type { NavIconName } from "./nav";

const icons = {
  inbox: Inbox,
  cadastros: UserPlus,
  orcamentos: FileText,
  pedidos: ClipboardList,
  vendas: Receipt,
  estoque: Package,
  usuarios: Users,
  tema: Palette,
  config: Settings,
  avisos: Bell,
} as const;

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = icons[name];
  return <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />;
}
