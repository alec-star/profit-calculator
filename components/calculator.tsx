"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TARGET_MARGINS = [0, 0.10, 0.20, 0.30, 0.40, 0.50];

// Tint system: very light backgrounds that hint at the metric's feeling
const MARGIN_COLORS: Record<number, string> = {
  0: "bg-red-50/80",        // Risk - breakeven
  0.10: "bg-amber-50/80",   // Warning - low margin
  0.20: "bg-emerald-50/80", // Good - decent margin
  0.30: "bg-emerald-50/80", // Good - healthy margin
  0.40: "bg-emerald-50/80", // Good - strong margin
  0.50: "bg-emerald-50/80", // Good - excellent margin
};

// ROAS health indicator: green < 1.5x, yellow 1.5-2.0x, red > 2.0x
function getRoasBackground(roas: number): string {
  if (roas <= 0 || !isFinite(roas)) return "bg-gray-50/80 border-gray-100";
  if (roas < 1.5) return "bg-emerald-50/80 border-emerald-100";
  if (roas <= 2.0) return "bg-amber-50/80 border-amber-100";
  return "bg-red-50/80 border-red-100";
}

interface CalcInputs {
  sellingPrice: number;
  cogs: number;
  taxPercent: number;
  adSpend: number;
  feesPercent: number;
  feesCents: number;
  otherCostsPercent: number;
  fixedFeesPerUnit: number;
  monthlyOverhead: number;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ShopifyPlan = "basic" | "shopify" | "advanced" | "custom";

const SHOPIFY_FEES: Record<ShopifyPlan, { percent: number; cents: number; label: string }> = {
  basic: { percent: 2.9, cents: 30, label: "Basic (2.9% + 30¢)" },
  shopify: { percent: 2.6, cents: 30, label: "Shopify (2.6% + 30¢)" },
  advanced: { percent: 2.4, cents: 30, label: "Advanced (2.4% + 30¢)" },
  custom: { percent: 0, cents: 0, label: "Custom" },
};




function CalcField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProfitCalculator() {
  const [inputs, setInputs] = useState<CalcInputs>({
    sellingPrice: 50,
    cogs: 10,
    taxPercent: 0,
    adSpend: 0,
    feesPercent: 2.9,
    feesCents: 30,
    otherCostsPercent: 0,
    fixedFeesPerUnit: 0,
    monthlyOverhead: 0,
  });
  const [shopifyPlan, setShopifyPlan] = useState<ShopifyPlan>("basic");
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const isValidEmail = EMAIL_REGEX.test(email);

  const handleWaitlist = async () => {
    if (!isValidEmail) return;
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setWaitlistStatus("success");
        setEmail("");
      } else {
        setWaitlistStatus("error");
      }
    } catch {
      setWaitlistStatus("error");
    }
  };

  const updateInput = useCallback((key: keyof CalcInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (key === "feesPercent" || key === "feesCents") {
      setShopifyPlan("custom");
    }
  }, []);

  const handlePlanChange = useCallback((plan: ShopifyPlan) => {
    setShopifyPlan(plan);
    if (plan !== "custom") {
      const fees = SHOPIFY_FEES[plan];
      setInputs((prev) => ({ ...prev, feesPercent: fees.percent, feesCents: fees.cents }));
    }
  }, []);

  // Calculate margin scenarios based on user's selling price
  const marginScenarios = useMemo(() => {
    const { sellingPrice, adSpend } = inputs;

    return TARGET_MARGINS.map((margin) => {
      // Calculate profit at this margin target
      const targetProfit = sellingPrice * margin;
      const breakevenRoas = targetProfit > 0.01 ? sellingPrice / targetProfit : Infinity;
      const breakevenOrders = targetProfit > 0.01 ? Math.ceil(adSpend / targetProfit) : Infinity;
      return {
        margin,
        price: sellingPrice,
        profit: Math.round(targetProfit * 100) / 100,
        breakevenRoas: isFinite(breakevenRoas) ? Math.round(breakevenRoas * 100) / 100 : Infinity,
        breakevenOrders: isFinite(breakevenOrders) ? breakevenOrders : Infinity,
      };
    });
  }, [inputs]);

  const results = useMemo(() => {
    const { sellingPrice, cogs, taxPercent, adSpend, feesPercent, feesCents, otherCostsPercent, fixedFeesPerUnit, monthlyOverhead } = inputs;

    if (!sellingPrice || sellingPrice <= 0) {
      return { hasSellingPrice: false, breakevenRoas: 0, breakevenUnits: 0, profitPerUnit: 0, hasAdSpend: false };
    }

    const grossMargin = sellingPrice - cogs - fixedFeesPerUnit;
    const processingFees = (sellingPrice * (feesPercent / 100)) + (feesCents / 100);
    const taxCost = sellingPrice * (taxPercent / 100);
    const otherCosts = sellingPrice * (otherCostsPercent / 100);
    const profitPerUnit = grossMargin - processingFees - taxCost - otherCosts;

    const fixedCosts = adSpend + monthlyOverhead;
    const breakevenUnits = profitPerUnit > 0 && fixedCosts > 0 ? Math.ceil(fixedCosts / profitPerUnit) : 0;
    const breakevenRoas = profitPerUnit > 0 ? sellingPrice / profitPerUnit : 0;

    return { hasSellingPrice: true, breakevenRoas, breakevenUnits, profitPerUnit, hasAdSpend: adSpend > 0 };
  }, [inputs]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <main className="mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <img src="/logo-black.png" alt="TrueMargin Labs" className="h-20 mx-auto mb-2" />
          <img src="/typeface-lightblack.png" alt="TrueMargin Labs" className="h-8 mx-auto mb-4" />
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Calculate your true margin, breakeven ROAS, PROAS, and exactly how many sales you need before spending on ads.
          </p>
        </div>


        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CalcField label="Selling Price" value={inputs.sellingPrice} onChange={(v) => updateInput("sellingPrice", v)} prefix="$" placeholder="50" />
                <CalcField label="Cost of Goods Sold" value={inputs.cogs} onChange={(v) => updateInput("cogs", v)} prefix="$" placeholder="10" />
                <CalcField label="Tax/VAT" value={inputs.taxPercent} onChange={(v) => updateInput("taxPercent", v)} suffix="%" placeholder="0" />
                <CalcField label="Ad Spend" value={inputs.adSpend} onChange={(v) => updateInput("adSpend", v)} prefix="$" placeholder="50" />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Processing Fees</Label>
                  <select
                    value={shopifyPlan}
                    onChange={(e) => handlePlanChange(e.target.value as ShopifyPlan)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.entries(SHOPIFY_FEES).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                  {shopifyPlan === "custom" && (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input type="number" value={inputs.feesPercent || ""} onChange={(e) => updateInput("feesPercent", parseFloat(e.target.value) || 0)} placeholder="2.9" className="h-8 text-sm pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      <div className="relative flex-1">
                        <Input type="number" value={inputs.feesCents || ""} onChange={(e) => updateInput("feesCents", parseFloat(e.target.value) || 0)} placeholder="30" className="h-8 text-sm pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">¢</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#00d084]/30 flex-1">
              <CardContent className="p-6 text-center flex flex-col justify-center h-full">
                <img src="/apex-coming-soon.png" alt="True Margin APEX - Arriving March 2026" className="h-[61px] mx-auto mb-6" />
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {!emailFocused && !email && (
                      <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
                        Enter your email
                      </span>
                    )}
                  </div>
                  {waitlistStatus === "success" ? (
                    <p className="text-[#00d084] font-bold py-2">{"You're on the list! 🎉"}</p>
                  ) : (
                    <>
                      <button
                        onClick={handleWaitlist}
                        disabled={waitlistStatus === "loading" || !isValidEmail}
                        style={{
                          background: "linear-gradient(135deg, #00d084 0%, #00ff9f 100%)",
                          boxShadow: "0 12px 32px rgba(0, 208, 132, 0.35)",
                        }}
                        className="w-full text-white font-bold py-3 px-4 rounded-lg cursor-pointer transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,208,132,0.45)]"
                      >
                        {waitlistStatus === "loading" ? "Joining..." : "Join Waitlist"}
                      </button>
                      {waitlistStatus === "error" && (
                        <p className="text-red-500 text-sm mt-2">Something went wrong. Please try again.</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">💰</span>
                      <div>
                        <h3 className="font-extrabold text-lg">Unit Economics</h3>
                        <p className="text-sm text-muted-foreground">Your profit per sale</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50/80 rounded-lg border border-emerald-100">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Profit/Unit</p>
                        <p className="text-2xl font-extrabold text-[#00d084]">{results.hasSellingPrice ? `$${results.profitPerUnit.toFixed(2)}` : "—"}</p>
                        {!results.hasSellingPrice && <p className="text-xs text-muted-foreground mt-1">Add selling price</p>}
                      </div>
                      <div className="p-4 bg-emerald-50/80 rounded-lg border border-emerald-100">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Net Margin</p>
                        <p className="text-2xl font-extrabold text-[#00d084]">{results.hasSellingPrice ? `${((results.profitPerUnit / inputs.sellingPrice) * 100).toFixed(0)}%` : "—"}</p>
                        {!results.hasSellingPrice && <p className="text-xs text-muted-foreground mt-1">Add selling price</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      Breakeven Point
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${getRoasBackground(results.breakevenRoas)}`}>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Breakeven ROAS</p>
                        <p className="text-3xl font-extrabold text-[#00d084]">{results.hasSellingPrice && results.breakevenRoas > 0 ? `${results.breakevenRoas.toFixed(2)}x` : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{results.hasSellingPrice ? "Minimum ROAS needed" : "Add selling price"}</p>
                      </div>
                      <div className="p-4 bg-emerald-50/80 rounded-lg border border-emerald-100">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Units to Profit</p>
                        {results.hasAdSpend ? (
                          <>
                            <p className="text-3xl font-extrabold text-[#00d084]">{results.breakevenUnits}</p>
                            <p className="text-xs text-muted-foreground mt-1">${(results.breakevenUnits * inputs.sellingPrice).toLocaleString()} revenue</p>
                          </>
                        ) : (
                          <>
                            <p className="text-3xl font-extrabold text-muted-foreground">—</p>
                            <p className="text-xs text-muted-foreground mt-1">Add ad spend</p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-base">✨</span>
                      Net Margin Scenarios
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">At your ${inputs.sellingPrice} selling price</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1.5 pl-3 font-medium text-muted-foreground">Margin</th>
                            <th className="text-right py-1.5 font-medium text-muted-foreground">Price</th>
                            <th className="text-right py-1.5 font-medium text-muted-foreground">BE ROAS</th>
                            <th className="text-right py-1.5 pr-3 font-medium text-muted-foreground">Orders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marginScenarios.map((scenario) => (
                            <tr key={scenario.margin} className={`border-b border-muted/50 ${MARGIN_COLORS[scenario.margin] || ""}`}>
                              <td className="py-1.5 pl-3 font-medium">{scenario.margin === 0 ? "BE" : `${(scenario.margin * 100).toFixed(0)}%`}</td>
                              <td className="text-right py-1.5">${inputs.sellingPrice}</td>
                              <td className={`text-right py-1.5 text-[#00d084] font-medium`}>
                              <span className={`px-1.5 py-0.5 rounded ${getRoasBackground(scenario.breakevenRoas)}`}>
                                {isFinite(scenario.breakevenRoas) ? `${scenario.breakevenRoas.toFixed(2)}x` : "∞"}
                              </span>
                            </td>
                              <td className="text-right py-1.5 pr-3">{isFinite(scenario.breakevenOrders) ? scenario.breakevenOrders : "∞"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
          </div>
        </div>
      </main>

      <footer className="border-t mt-8 py-6 text-center">
        <img src="/footer.png" alt="Free forever. By TrueMargin." className="h-6 mx-auto" />
      </footer>
    </div>
  );
}
