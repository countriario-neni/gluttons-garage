"use client";

import { useState } from "react";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Segment } from "@/domain/types";
import { templates } from "@/integrations/whatsapp/templates";
import { useLive, useStore } from "@/store";
import type { CustomerStats } from "@/store/DataStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { staffErrorCopy } from "./format";
import { PhonePreview } from "./PhonePreview";

const MAX = 1000;
const SELECT =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

const SEGMENTS: { key: Segment; label: string; tag: CustomerStats["tags"][number] | null }[] = [
  { key: "all_opted_in", label: "Everyone who opted in", tag: null },
  { key: "new", label: "New customers", tag: "new" },
  { key: "regular", label: "Regulars", tag: "regular" },
  { key: "vip", label: "VIPs", tag: "vip" },
  { key: "inactive_30d", label: "Inactive for 30+ days", tag: "inactive" },
];
const segmentLabel = (s: Segment) => SEGMENTS.find((x) => x.key === s)?.label ?? s;

const TEMPLATES = [
  { key: "tiramisu_fest", label: "Tiramisu Fest is back" },
  { key: "mango_mania", label: "Mango Mania" },
  { key: "we_miss_you", label: "We miss you (15% off with WINBACK15)" },
  { key: "new_menu", label: "New menu" },
] as const;
const CUSTOM = "custom";

/** Opted-in customers in the segment (the tag comes from the store's customer stats). */
export function recipientsOf(customers: CustomerStats[], segment: Segment): CustomerStats[] {
  const tag = SEGMENTS.find((s) => s.key === segment)?.tag ?? null;
  return customers.filter((c) => c.marketingOptIn && (tag === null || c.tags.includes(tag)));
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function CampaignComposer() {
  const customers = useLive("orders", (s) => s.listCustomers());
  const history = useLive("messages", (s) => s.listCampaigns());
  const [segment, setSegment] = useState<Segment>("all_opted_in");
  const [template, setTemplate] = useState<string>("tiramisu_fest");
  const [body, setBody] = useState<string>(templates.campaign.tiramisu_fest);
  const [confirm, setConfirm] = useState(false);
  const store = useStore();

  const count = customers.data ? recipientsOf(customers.data, segment).length : null;
  const name = TEMPLATES.find((t) => t.key === template)?.label ?? "Custom message";
  const trimmed = body.trim();
  const canSend = count !== null && count > 0 && trimmed.length > 0 && body.length <= MAX;

  const pick = (key: string) => {
    setTemplate(key);
    if (key !== CUSTOM) setBody(templates.campaign[key]);
  };

  const send = async () => {
    try {
      const c = await store.sendCampaign({ name, segment, body: trimmed });
      toast.success(`Queued to ${c.sentCount} customers (demo — no messages sent)`);
      void history.reload();
    } catch (e) {
      toast.error(staffErrorCopy(e));
    }
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="compose" className="grid content-start gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 id="compose" className="text-xl font-bold">
            New campaign
          </h2>

          <div className="grid gap-1.5">
            <Label htmlFor="cmp-segment" className="text-base">Who gets it</Label>
            <select id="cmp-segment" className={SELECT} value={segment} onChange={(e) => setSegment(e.target.value as Segment)}>
              {SEGMENTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="flex items-center gap-2 text-base" role="status" data-testid="recipient-count">
              <Users className="size-5 text-muted-foreground" aria-hidden="true" />
              {count === null ? "Counting…" : <><strong className="tabular-nums">{count}</strong>&nbsp;{count === 1 ? "customer" : "customers"} will receive this</>}
            </p>
            <p className="text-sm text-muted-foreground">Only customers who opted in to marketing are ever included.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cmp-template" className="text-base">Template</Label>
            <select id="cmp-template" className={SELECT} value={template} onChange={(e) => pick(e.target.value)}>
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
              <option value={CUSTOM}>Write my own</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cmp-body" className="text-base">Message</Label>
            <Textarea
              id="cmp-body"
              value={body}
              maxLength={MAX}
              rows={6}
              className="min-h-36 text-base"
              onChange={(e) => {
                setBody(e.target.value);
                if (template !== CUSTOM && e.target.value !== templates.campaign[template]) setTemplate(CUSTOM);
              }}
              aria-describedby="cmp-help"
            />
            <div id="cmp-help" className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <span>
                <code className="font-mono">{"{name}"}</code> becomes each customer&apos;s first name. Wrap words in *stars* for bold.
              </span>
              <span className="tabular-nums" aria-live="polite">
                {body.length} / {MAX}
              </span>
            </div>
          </div>

          <div>
            <Button type="button" className="h-12 px-6 text-base" disabled={!canSend} onClick={() => setConfirm(true)}>
              <Send className="size-5" aria-hidden="true" /> Send campaign
            </Button>
            {count === 0 && <p className="mt-2 text-sm text-muted-foreground">No one is in this segment right now.</p>}
          </div>
        </section>

        <section aria-labelledby="preview" className="lg:sticky lg:top-6 lg:self-start">
          <h2 id="preview" className="mb-3 text-xl font-bold">
            Preview
          </h2>
          <PhonePreview body={body} />
        </section>
      </div>

      <section aria-labelledby="history" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 id="history" className="mb-3 text-xl font-bold">
          Sent campaigns
        </h2>
        {history.data && history.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base" aria-label="Campaign history">
              <thead className="text-sm text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-bold">Campaign</th>
                  <th scope="col" className="px-3 py-2 font-bold">Segment</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Sent to</th>
                  <th scope="col" className="py-2 pl-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((c) => (
                  <tr key={c.id} className="border-t border-border" data-testid="campaign-row">
                    <th scope="row" className="py-2 pr-3 font-normal">{c.name}</th>
                    <td className="px-3 py-2">{segmentLabel(c.segment)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.sentCount}</td>
                    <td className="py-2 pl-3 whitespace-nowrap">{when(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">{history.loading ? "Loading…" : "Nothing sent yet. Your campaigns will be listed here."}</p>
        )}
      </section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Send to ${count ?? 0} ${count === 1 ? "customer" : "customers"}?`}
        description={`"${name}" goes to ${segmentLabel(segment).toLowerCase()}. This is a demo: nothing is actually sent, the messages are only logged.`}
        confirmLabel="Send now"
        cancelLabel="Not yet"
        onConfirm={send}
      />
    </div>
  );
}
