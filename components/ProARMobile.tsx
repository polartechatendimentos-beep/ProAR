"use client";

import { ProARFieldMobile } from "@/components/ProARFieldMobile";

/**
 * ProAR Field lives at /mobile and uses the existing authenticated ProAR
 * domain and tenant database. Unlike the Expo demo, this screen never
 * creates fake service orders or simulates successful synchronization.
 */
export function ProARMobile() {
  return <ProARFieldMobile />;
}
