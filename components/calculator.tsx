"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Target,
  DollarSign,
  Sparkles,
  Zap,
  Trophy,
  Rocket,
  Package,
  Plus,
  Trash2,
} from "lucide-react";

interface CalcInputs {
  sellingPrice: number;
  cogs: number;
  adSpend: number;
  feesPercent: number;
  otherCostsPercent: number;
  fixedFeesPerUnit: number;
  monthlyOverhead: number;
  unitsSold: number;
}

interface BundleTier {
  quantity: number;
  price: number;
  cogsPerUnit: number;
}

interface BundleResults {
  quantity: number;
  price: number;
  totalCogs: number;
  profitPerOrder: number;
  breakevenRoas: number;
  breakevenOrders: number;
}

interface Preset {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  values: Partial<CalcInputs>;
}

const PRESETS: Preset[] = [
  {
    name: "10% Profit",
    description: "Conservative goal",
    icon: <Target className="h-4 w-4" />,
    color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-600",
    values: { sellingPrice: 39.99, cogs: 15, feesPercent: 3, otherCostsPercent: 5 },
  },
  {
    name: "20% Typical",
    description: "Standard dropship",
    icon: <Zap className="h-4 w-4" />,
    color: "bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-600",
    values: { sellingPrice: 49.99, cogs: 18, feesPercent: 3, otherCostsPercent: 5 },
  },
  {
    name: "30% Target",
    description: "Optimized store",
    icon: <Trophy className="h-4 w-4" />,
    color: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-600",
    values: { sellingPrice: 59.99, cogs: 15, feesPercent: 2.9, otherCostsPercent: 4 },
  },
  {
    name: "40% High-Margin",
    description: "Premium brand",
    icon: <Rocket className="h-4 w-4" />,
    color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-600",
    values: { sellingPrice: 89.99, cogs: 20, feesPercent: 2.5, otherCostsPercent: 3 },
  },
];

function Tooltip({ content }: { content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-popover text-popover-foreground rounded-lg shadow-lg border max-w-[250px] whitespace-normal">
          {content}
        </div>
      )}
    </div>
  );
}

function CalcField({
  label,
  tooltip,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <Tooltip content={tooltip} />
      </div>
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
    sellingPrice: 49.99,
    cogs: 18,
    adSpend: 50,
    feesPercent: 3,
    otherCostsPercent: 0,
    fixedFeesPerUnit: 0,
    monthlyOverhead: 0,
    unitsSold: 0,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [bundleMode, setBundleMode] = useState(false);
  const [bundleTiers, setBundleTiers] = useState<BundleTier[]>([
    { quantity: 1, price: 40, cogsPerUnit: 18 },
    { quantity: 2, price: 70, cogsPerUnit: 18 },
  ]);

  const updateInput = useCallback((key: keyof CalcInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  }, []);

  const applyPreset = useCallback((preset: Preset, index: number) => {
    setInputs((prev) => ({ ...prev, ...preset.values }));
    setActivePreset(index);
  }, []);

  const updateBundleTier = useCallback((index: number, field: keyof BundleTier, value: number) => {
    setBundleTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const addBundleTier = useCallback(() => {
    if (bundleTiers.length < 4) {
      const lastTier = bundleTiers[bundleTiers.length - 1];
      setBundleTiers((prev) => [
        ...prev,
        { quantity: lastTier.quantity + 1, price: Math.round(lastTier.price * 1.4), cogsPerUnit: lastTier.cogsPerUnit },
      ]);
    }
  }, [bundleTiers]);

  const removeBundleTier = useCallback((index: number) => {
    if (bundleTiers.length > 1) {
      setBundleTiers((prev) => prev.filter((_, i) => i !== index));
    }
  }, [bundleTiers.length]);

  const bundleResults: BundleResults[] = useMemo(() => {
    if (!bundleMode) return [];
    const { adSpend, feesPercent, otherCostsPercent } = inputs;
    return bundleTiers.map((tier) => {
      const totalCogs = tier.cogsPerUnit * tier.quantity;
      const fees = tier.price * (feesPercent / 100);
      const otherCosts = tier.price * (otherCostsPercent / 100);
      const profitPerOrder = tier.price - totalCogs - fees - otherCosts;
      const breakevenRoas = profitPerOrder > 0 ? tier.price / profitPerOrder : 0;
      const breakevenOrders = profitPerOrder > 0 ? Math.ceil(adSpend / profitPerOrder) : 0;
      return { quantity: tier.quantity, price: tier.price, totalCogs, profitPerOrder, breakevenRoas, breakevenOrders };
    });
  }, [bundleMode, bundleTiers, inputs]);

  const results = useMemo(() => {
    const { sellingPrice, cogs, adSpend, feesPercent, otherCostsPercent, fixedFeesPerUnit, monthlyOverhead } = inputs;

    if (sellingPrice <= 0 || cogs >= sellingPrice) {
      return { isValid: false, breakevenRoas: 0, breakevenUnits: 0, profitPerUnit: 0 };
    }

    const grossMargin = sellingPrice - cogs - fixedFeesPerUnit;
    const variableCosts = sellingPrice * ((feesPercent + otherCostsPercent) / 100);
    const profitPerUnit = grossMargin - variableCosts;

    if (profitPerUnit <= 0) {
      return { isValid: false, breakevenRoas: 0, breakevenUnits: 0, profitPerUnit };
    }

    const fixedCosts = adSpend + monthlyOverhead;
    const breakevenUnits = fixedCosts > 0 ? Math.ceil(fixedCosts / profitPerUnit) : 0;
    const breakevenRoas = adSpend > 0 && profitPerUnit > 0 ? sellingPrice / profitPerUnit : 0;

    return { isValid: true, breakevenRoas, breakevenUnits, profitPerUnit };
  }, [inputs]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <span className="font-bold">TrueMargin</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Dropshipping Profit Calculator</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Calculate your breakeven ROAS and units needed to profit. Free forever.
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            Quick Presets
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PRESETS.map((preset, index) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset, index)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${preset.color} ${
                  activePreset === index ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {preset.icon}
                  <span className="font-semibold text-sm">{preset.name}</span>
                </div>
                <p className="text-xs opacity-70">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Your Numbers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CalcField label="Selling Price" tooltip="Price per unit" value={inputs.sellingPrice} onChange={(v) => updateInput("sellingPrice", v)} prefix="$" placeholder="49.99" />
                <CalcField label="COGS" tooltip="Cost of goods per unit" value={inputs.cogs} onChange={(v) => updateInput("cogs", v)} prefix="$" placeholder="18" />
                <CalcField label="Ad Spend" tooltip="Total ad budget" value={inputs.adSpend} onChange={(v) => updateInput("adSpend", v)} prefix="$" placeholder="50" />
                <CalcField label="Fees" tooltip="Payment processing fees" value={inputs.feesPercent} onChange={(v) => updateInput("feesPercent", v)} suffix="%" placeholder="3" />
              </CardContent>
            </Card>

            <Card>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <span className="text-sm font-medium">Advanced Options</span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showAdvanced && (
                <CardContent className="pt-0 space-y-4">
                  <CalcField label="Other Costs %" tooltip="Shipping, returns, etc." value={inputs.otherCostsPercent} onChange={(v) => updateInput("otherCostsPercent", v)} suffix="%" placeholder="0" />
                  <CalcField label="Monthly Overhead" tooltip="Fixed monthly costs" value={inputs.monthlyOverhead} onChange={(v) => updateInput("monthlyOverhead", v)} prefix="$" placeholder="0" />
                </CardContent>
              )}
            </Card>

            <Card>
              <button onClick={() => setBundleMode(!bundleMode)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">Offer Builder</span>
                </div>
                {bundleMode && <span className="text-xs text-green-600 font-medium">ON</span>}
              </button>
              {bundleMode && (
                <CardContent className="pt-0 space-y-4">
                  {bundleTiers.map((tier, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Buy {tier.quantity}</span>
                        {bundleTiers.length > 1 && (
                          <button onClick={() => removeBundleTier(index)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" value={tier.quantity} onChange={(e) => updateBundleTier(index, "quantity", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Price</Label>
                          <Input type="number" value={tier.price} onChange={(e) => updateBundleTier(index, "price", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">COGS/unit</Label>
                          <Input type="number" value={tier.cogsPerUnit} onChange={(e) => updateBundleTier(index, "cogsPerUnit", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {bundleTiers.length < 4 && (
                    <Button variant="outline" size="sm" onClick={addBundleTier} className="w-full gap-2">
                      <Plus className="h-4 w-4" /> Add Offer
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {bundleMode && bundleResults.length > 0 ? (
              <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    Offer Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {bundleResults.map((result, index) => (
                      <div key={index} className="p-4 bg-card rounded-lg border">
                        <div className="flex justify-between mb-3">
                          <span className="font-semibold">Buy {result.quantity}</span>
                          <span className="font-bold">${result.price}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div><p className="text-xs text-muted-foreground">COGS</p><p className="font-medium">${result.totalCogs}</p></div>
                          <div><p className="text-xs text-muted-foreground">Profit</p><p className={`font-medium ${result.profitPerOrder > 0 ? "text-green-600" : "text-red-600"}`}>${result.profitPerOrder.toFixed(2)}</p></div>
                          <div><p className="text-xs text-muted-foreground">BE ROAS</p><p className="font-medium text-yellow-600">{result.breakevenRoas.toFixed(2)}x</p></div>
                          <div><p className="text-xs text-muted-foreground">Orders</p><p className="font-medium text-green-600">{result.breakevenOrders}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : results.isValid ? (
              <>
                <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Pre-Sale Analysis</h3>
                        <p className="text-sm text-muted-foreground">Your breakeven numbers</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-card rounded-lg border">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Profit Per Unit</p>
                        <p className="text-2xl font-bold text-green-600">${results.profitPerUnit.toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-card rounded-lg border">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Contribution</p>
                        <p className="text-2xl font-bold text-primary">{((results.profitPerUnit / inputs.sellingPrice) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-yellow-600" />
                      Breakeven Point
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Breakeven ROAS</p>
                        <p className="text-3xl font-bold text-yellow-600">{results.breakevenRoas.toFixed(2)}x</p>
                        <p className="text-xs text-muted-foreground mt-1">Minimum ROAS needed</p>
                      </div>
                      <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Units to Profit</p>
                        <p className="text-3xl font-bold text-green-600">{results.breakevenUnits}</p>
                        <p className="text-xs text-muted-foreground mt-1">${(results.breakevenUnits * inputs.sellingPrice).toLocaleString()} revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6 text-center">
                  <Calculator className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                  <p className="text-yellow-600 font-medium">Enter valid numbers to see results</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
        <p>Free forever. By TrueMargin.</p>
      </footer>
    </div>
  );
}
