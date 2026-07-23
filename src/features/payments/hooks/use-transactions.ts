import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { PaymentProvider } from "@/lib/types/payment";
import { listTransactions } from "../api/payments";

export function useTransactionsQuery(provider: PaymentProvider | "") {
  return useQuery({
    queryKey: qk.transactions.list({ provider }),
    queryFn: () => listTransactions({ provider: provider || undefined }),
  });
}
