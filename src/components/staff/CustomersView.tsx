"use client";

import { useSearchParams } from "next/navigation";
import { CustomerProfile } from "./CustomerProfile";
import { CustomerTable } from "./CustomerTable";

/** /staff/customers/ is the list; /staff/customers/?id=… is one profile (static export: no dynamic segments). */
export function CustomersView() {
  const id = useSearchParams().get("id");
  return id ? <CustomerProfile key={id} id={id} /> : <CustomerTable />;
}
