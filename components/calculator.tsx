"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
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
  if (roas <= 1.7) return "bg-emerald-50/80 border-emerald-100";
  if (roas <= 2.5) return "bg-amber-50/80 border-amber-100";
  return "bg-red-50/80 border-red-100";
}

interface CalcInputs {
  sellingPrice: number;
  cogs: number;
  taxPercent: number;
  refundPercent: number;
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
    refundPercent: 0,
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
  const [showSuccessFooter, setShowSuccessFooter] = useState(false);

  const isValidEmail = EMAIL_REGEX.test(email);

  // Show success footer + hide after 3s
  useEffect(() => {
    if (waitlistStatus === "success") {
      setShowSuccessFooter(true);
      const timer = setTimeout(() => {
        setShowSuccessFooter(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [waitlistStatus]);

  const handleWaitlist = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isValidEmail) return;

    // Capture exact cursor position for confetti
    const clickOrigin = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        // Fire confetti from button position
        confetti({
          particleCount: 80,
          spread: 60,
          origin: clickOrigin,
          colors: ["#00d084", "#00ff9f", "#ffffff"],
        });
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
    const { sellingPrice, cogs, taxPercent, refundPercent, adSpend, feesPercent, feesCents, otherCostsPercent, fixedFeesPerUnit, monthlyOverhead } = inputs;

    if (!sellingPrice || sellingPrice <= 0) {
      return { hasSellingPrice: false, breakevenRoas: 0, breakevenUnits: 0, profitPerUnit: 0, hasAdSpend: false };
    }

    const grossMargin = sellingPrice - cogs - fixedFeesPerUnit;
    const processingFees = (sellingPrice * (feesPercent / 100)) + (feesCents / 100);
    const taxCost = sellingPrice * (taxPercent / 100);
    const refundCost = sellingPrice * (refundPercent / 100);
    const otherCosts = sellingPrice * (otherCostsPercent / 100);
    const profitPerUnit = grossMargin - processingFees - taxCost - refundCost - otherCosts;

    const fixedCosts = adSpend + monthlyOverhead;
    const breakevenUnits = profitPerUnit > 0 && fixedCosts > 0 ? Math.ceil(fixedCosts / profitPerUnit) : 0;
    const breakevenRoas = profitPerUnit > 0 ? sellingPrice / profitPerUnit : 0;

    return { hasSellingPrice: true, breakevenRoas, breakevenUnits, profitPerUnit, hasAdSpend: adSpend > 0 };
  }, [inputs]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <main className="mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <Image src="/logo-black.png" alt="TrueMargin Labs" width={106} height={106} className="mx-auto mb-2" />
          <Image src="/typeface-lightblack.png" alt="TrueMargin Labs" width={200} height={24} className="mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide mb-2 whitespace-nowrap">Real Margins. Real Profits. Real Fast.</h1>
          <h2 className="text-lg text-muted-foreground">From operators, for operators</h2>
        </div>


        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          <div className="flex flex-col gap-4">
            <Card className="card-hover">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CalcField label="Selling Price" value={inputs.sellingPrice} onChange={(v) => updateInput("sellingPrice", v)} prefix="$" placeholder="50" />
                <CalcField label="Cost of Goods Sold" value={inputs.cogs} onChange={(v) => updateInput("cogs", v)} prefix="$" placeholder="10" />
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
                <div className="grid grid-cols-2 gap-3">
                  <CalcField label="Tax / VAT" value={inputs.taxPercent} onChange={(v) => updateInput("taxPercent", v)} suffix="%" placeholder="0" />
                  <CalcField label="Refund Rate" value={inputs.refundPercent} onChange={(v) => updateInput("refundPercent", v)} suffix="%" placeholder="0" />
                </div>
              </CardContent>
            </Card>

            {/* APEX card - desktop only (in sidebar) */}
            <Card className="card-hover border-[#00d084]/30 flex-1 hidden lg:block">
              <CardContent className="p-6 text-center flex flex-col justify-center h-full">
                <Image src="/dashboard-coming-soon.png" alt="True Margin APEX - Arriving March 2026" width={300} height={61} className="mx-auto mb-6" />
                {waitlistStatus === "success" ? (
                  <p className="text-[#00d084] font-bold py-2">{"You're on the list!"}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="relative flex-[2]">
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          className="flex h-14 w-full rounded-md border border-input bg-background px-4 py-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {!emailFocused && !email && (
                          <span className="absolute inset-0 flex items-center justify-start pl-4 text-base text-muted-foreground pointer-events-none">
                            Enter your email
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleWaitlist}
                        disabled={waitlistStatus === "loading" || !isValidEmail}
                        style={{
                          background: "linear-gradient(135deg, #00d084 0%, #00ff9f 100%)",
                          boxShadow: "0 12px 32px rgba(0, 208, 132, 0.35)",
                        }}
                        className="text-white font-bold h-14 px-6 rounded-lg cursor-pointer transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,208,132,0.45)] whitespace-nowrap"
                      >
                        {waitlistStatus === "loading" ? "Joining..." : "Get Early Access"}
                      </button>
                    </div>
                    {waitlistStatus === "error" && (
                      <p className="text-red-500 text-sm text-center">Something went wrong. Please try again.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <h3 className="font-extrabold text-lg">Unit Economics</h3>
                      <p className="text-sm text-muted-foreground">Your profit per sale</p>
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
                    <CardTitle className="text-sm">Breakeven Point</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${getRoasBackground(results.breakevenRoas)}`}>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Breakeven ROAS</p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-[#00d084]">
                          {results.hasSellingPrice && results.breakevenRoas > 0 ? `${results.breakevenRoas.toFixed(2)}x` : "—"}
                        </p>
                        {results.hasSellingPrice && results.breakevenRoas > 0 && (
                          <p className="text-sm font-semibold text-muted-foreground">
                            ${(inputs.sellingPrice / results.breakevenRoas).toFixed(2)} CPA
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{results.hasSellingPrice ? "Minimum ROAS needed" : "Add selling price"}</p>
                      </div>
                      <div className="p-4 bg-emerald-50/80 rounded-lg border border-emerald-100">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Units to Profit</p>
                        {results.hasAdSpend ? (
                          <>
                            <p className="text-2xl sm:text-3xl font-extrabold text-[#00d084]">{results.breakevenUnits}</p>
                            <p className="text-xs text-muted-foreground mt-1">${(results.breakevenUnits * inputs.sellingPrice).toLocaleString()} revenue</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl sm:text-3xl font-extrabold text-muted-foreground">—</p>
                            <p className="text-xs text-muted-foreground mt-1">Add ad spend</p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile email signup */}
                <Card className="lg:hidden border-[#00d084]/30">
                  <CardContent className="p-4 text-center">
                    <Image src="/dashboard-coming-soon.png" alt="True Margin APEX" width={200} height={48} className="mx-auto mb-3" />
                    {waitlistStatus === "success" ? (
                      <p className="text-[#00d084] font-bold py-2">{"You're on the list!"}</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setEmailFocused(true)}
                            onBlur={() => setEmailFocused(false)}
                            className="flex h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-base text-black text-left focus:outline-none focus:border-[#00d084] focus:ring-2 focus:ring-[#00d084]/20"
                          />
                          {!emailFocused && !email && (
                            <span className="absolute inset-0 flex items-center justify-start pl-4 text-sm text-muted-foreground pointer-events-none">
                              Enter your email
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleWaitlist}
                          disabled={waitlistStatus === "loading" || !isValidEmail}
                          style={{
                            background: "linear-gradient(135deg, #00d084 0%, #00ff9f 100%)",
                            boxShadow: "0 8px 24px rgba(0, 208, 132, 0.35)",
                          }}
                          className="w-full text-white font-bold text-base py-3 px-6 rounded-lg cursor-pointer transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,208,132,0.45)]"
                        >
                          {waitlistStatus === "loading" ? "Joining..." : "Get Early Access"}
                        </button>
                        {waitlistStatus === "error" && (
                          <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Net Margin Scenarios</CardTitle>
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
                                {isFinite(scenario.breakevenRoas) ? `${scenario.breakevenRoas.toFixed(2)}x` : "N/A"}
                              </span>
                            </td>
                              <td className="text-right py-1.5 pr-3">{isFinite(scenario.breakevenOrders) ? scenario.breakevenOrders : "N/A"}</td>
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

      {/* Sticky email signup footer - desktop only */}
      <div className="footer-hover hidden sm:block fixed bottom-0 left-0 right-0 bg-white border-t border-[#00d084]/30 shadow-[0_-4px_20px_rgba(0,208,132,0.15)] px-8 py-3 z-50">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <Image src="/dashboard-coming-soon.png" alt="True Margin APEX" width={213} height={64} className="hidden sm:block h-16 w-auto" />
          {waitlistStatus === "success" ? (
            <p className="text-[#00d084] font-bold text-lg">{"You're on the list!"}</p>
          ) : (
            <>
              <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className="flex h-11 sm:h-16 w-full rounded-lg border border-[#e5e7eb] bg-white px-4 sm:px-5 py-2 sm:py-4 text-base sm:text-lg text-black text-left focus:outline-none focus:border-[#00d084] focus:ring-2 focus:ring-[#00d084]/20"
                />
                {!emailFocused && !email && (
                  <span className="absolute inset-0 flex items-center justify-start pl-4 sm:pl-5 text-sm sm:text-base text-muted-foreground pointer-events-none">
                    Enter your email
                  </span>
                )}
              </div>
              <button
                onClick={handleWaitlist}
                disabled={waitlistStatus === "loading" || !isValidEmail}
                style={{
                  background: "linear-gradient(135deg, #00d084 0%, #00ff9f 100%)",
                  boxShadow: "0 8px 24px rgba(0, 208, 132, 0.35)",
                }}
                className="w-full sm:w-auto text-white font-bold text-base sm:text-lg py-3 sm:py-4 px-6 sm:px-10 rounded-lg cursor-pointer transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,208,132,0.45)] whitespace-nowrap"
              >
                {waitlistStatus === "loading" ? "Joining..." : "Get Early Access"}
              </button>
            </>
          )}
        </div>
        {waitlistStatus === "error" && (
          <p className="text-red-500 text-sm text-center mt-2">Something went wrong. Please try again.</p>
        )}
      </div>

      {/* Success message - fades out after 3s */}
      {showSuccessFooter && (
        <div className="success-footer fixed bottom-0 left-0 right-0 bg-[#00d084] p-4 z-50">
          <p className="text-white font-bold text-center">{"You're on the list!"}</p>
        </div>
      )}

      <footer className="border-t mt-8 pt-6 pb-6 sm:pb-[7rem] text-center">
        <Image src="/footer.png" alt="Free forever. By TrueMargin." width={200} height={28} className="mx-auto h-7 w-auto" />
      </footer>
    </div>
  );
}
