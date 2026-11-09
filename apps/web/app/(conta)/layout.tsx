import { AccountChrome } from "@/ui/account/AccountChrome";

/** Conta out of MVP — keep routes compiling without tenant theme / billing. */
export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return <AccountChrome>{children}</AccountChrome>;
}
