import { trpc } from "@/lib/trpc";

/**
 * Igaz, ha a belépett felhasználó admin. Csak a felület elrejtésére való: a
 * tényleges jogosultságot a szerver adminProcedure-je dönti el.
 */
export function useIsAdmin(): boolean {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return meQuery.data?.role === "admin";
}
