import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  Contact,
  FileText,
  Inbox,
  MessageSquareText,
  Package,
  Palette,
  Receipt,
  Settings,
  Tags,
  UserPlus,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import type { NavIconName } from "./nav";

const icons = {
  conversas: MessageSquareText,
  contatos: Contact,
  empresas: Building2,
  cadastros: UserPlus,
  orcamentos: FileText,
  pedidos: ClipboardList,
  vendas: Receipt,
  estoque: Package,
  usuarios: Users,
  tema: Palette,
  config: Settings,
  avisos: Bell,
  labels: Tags,
  equipes: UsersRound,
  respostas: Zap,
  caixas: Inbox,
  relatorios: BarChart3,
} as const;

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = icons[name];
  return <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />;
}
