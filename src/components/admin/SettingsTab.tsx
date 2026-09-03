import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Link2, DatabaseZap } from "lucide-react";
import {
  DEFAULT_PLANS,
  getSetting,
  saveSetting,
  type EndpointsSetting,
  type PlansSetting,
} from "@/lib/admin";
import { Panel, goldBtn, softField } from "./ui";

const DEFAULT_ENDPOINTS: EndpointsSetting = {
  payment_backend_url: "",
  upload_backend_url: "",
  save_api_content: false,
};

export function SettingsTab() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => getSetting<PlansSetting>("plans", DEFAULT_PLANS) });
  const endQ = useQuery({
    queryKey: ["endpoints"],
    queryFn: () => getSetting<EndpointsSetting>("endpoints", DEFAULT_ENDPOINTS),
  });

  const [plans, setPlans] = useState<PlansSetting>(DEFAULT_PLANS);
  const [end, setEnd] = useState<EndpointsSetting>(DEFAULT_ENDPOINTS);

  useEffect(() => {
    if (plansQ.data) setPlans(plansQ.data);
  }, [plansQ.data]);
  useEffect(() => {
    if (endQ.data) setEnd(endQ.data);
  }, [endQ.data]);

  const savePlans = useMutation({
    mutationFn: () => saveSetting("plans", plans),
    onSuccess: () => {
      toast.success("Subscription prices saved");
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEnd = useMutation({
    mutationFn: () => saveSetting("endpoints", end),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editPlan = (tier: "vip" | "svip", idx: number, patch: Partial<PlansSetting["vip"][number]>) =>
    setPlans((p) => ({
      ...p,
      [tier]: p[tier].map((pl, i) => (i === idx ? { ...pl, ...patch } : pl)),
    }));

  return (
    <div className="space-y-5">
      <Panel
        title="Subscription prices"
        action={
          <button type="button" onClick={() => savePlans.mutate()} disabled={savePlans.isPending} className={`${goldBtn} inline-flex items-center gap-2`}>
            <Save className="size-4" /> Save prices
          </button>
        }
      >
        <div className="grid gap-5 xl:grid-cols-2">
          {(["vip", "svip"] as const).map((tier) => (
            <div key={tier}>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide opacity-60">
                {tier === "vip" ? "VIP Member" : "SVIP Member"}
              </p>
              <div className="space-y-2">
                {plans[tier].map((p, i) => (
                  <div key={p.id} className="grid gap-2 rounded-2xl bg-white/65 p-3 sm:grid-cols-[1.2fr_1fr_.7fr_.7fr]">
                    <input className={softField} value={p.name} onChange={(e) => editPlan(tier, i, { name: e.target.value })} placeholder="Plan name" />
                    <input
                      className={softField}
                      inputMode="numeric"
                      value={String(p.price)}
                      onChange={(e) => editPlan(tier, i, { price: Number(e.target.value) || 0 })}
                      placeholder="Price UGX"
                    />
                    <input
                      className={softField}
                      inputMode="numeric"
                      value={String(p.days)}
                      onChange={(e) => editPlan(tier, i, { days: Number(e.target.value) || 1 })}
                      placeholder="Days"
                    />
                    <input
                      className={softField}
                      inputMode="numeric"
                      title="Devices allowed at the same time"
                      value={String(Number(p.devices ?? 1) || 1)}
                      onChange={(e) => editPlan(tier, i, { devices: Number(e.target.value) || 1 })}
                      placeholder="Devices"
                    />
                    <input
                      className={`${softField} sm:col-span-4`}
                      value={p.note}
                      onChange={(e) => editPlan(tier, i, { note: e.target.value })}
                      placeholder="Short description"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Backends & content sync"
        action={
          <button type="button" onClick={() => saveEnd.mutate()} disabled={saveEnd.isPending} className={`${goldBtn} inline-flex items-center gap-2`}>
            <Save className="size-4" /> Save settings
          </button>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold opacity-70">
              <Link2 className="size-3.5" /> Payment backend URL
            </span>
            <input
              className={softField}
              placeholder="https://pay.example.com/api"
              value={end.payment_backend_url}
              onChange={(e) => setEnd({ ...end, payment_backend_url: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold opacity-70">
              <Link2 className="size-3.5" /> Upload backend URL
            </span>
            <input
              className={softField}
              placeholder="https://upload.example.com/api"
              value={end.upload_backend_url}
              onChange={(e) => setEnd({ ...end, upload_backend_url: e.target.value })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <DatabaseZap className="size-4" /> Save all content from API to the database
            </span>
            <input
              type="checkbox"
              className="size-5 accent-[oklch(0.82_0.1_65)]"
              checked={end.save_api_content}
              onChange={(e) => setEnd({ ...end, save_api_content: e.target.checked })}
            />
          </label>
          <p className="text-[11px] opacity-55">
            Payment and upload backends are wired once you share the endpoints — the URLs are stored here and read by the app.
          </p>
        </div>
      </Panel>
    </div>
  );
}
