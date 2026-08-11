import type { ReactNode } from "react";

/**
 * Recharts v3'ün Tooltip/Legend formatter prop tipleri (`Formatter<ValueType, NameType>`
 * gibi karmaşık intersection tipler) her çağrı noktasında birebir eşleştirmesi zor
 * jenerik imzalar üretiyor. `any` kullanmak yerine, tip güvenliğini büyük ölçüde
 * koruyan `unknown[]` argüman listesi + `ReactNode` dönüş tipiyle tek bir ortak tip
 * tanımlanır; her formatter gövdesi kendi ihtiyacı olan alanlara yalnızca gerekli
 * yerlerde tip daraltması (assertion) uygulayarak erişir.
 */
export type ChartFormatter = (...args: unknown[]) => ReactNode;
