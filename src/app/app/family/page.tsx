import { Users } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Check, Empty, Field, Input, PageTitle, Panel, Section } from "@/components/ui";
import { addHouseholdMember, createHousehold, shareVehicle } from "@/server/trust";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Family account" };

export default async function Family() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const [hRes, vRes] = await Promise.all([
    sb.from("households")
      .select("id, name, created_by, created_at, household_members(user_id, role, can_book, can_approve, added_at, profiles(full_name))")
      .order("created_at"),
    sb.from("vehicles")
      .select("id, reg_no, household_id, owner_id, vehicle_models(name, vehicle_makes(name))")
      .order("created_at", { ascending: false }),
  ]);

  const households = (hRes.data ?? []) as unknown as {
    id: string; name: string; created_by: string; created_at: string;
    household_members: {
      user_id: string; role: string; can_book: boolean; can_approve: boolean;
      added_at: string; profiles: { full_name: string | null } | null;
    }[];
  }[];
  const vehicles = (vRes.data ?? []) as unknown as {
    id: string; reg_no: string | null; household_id: string | null; owner_id: string;
    vehicle_models: { name: string; vehicle_makes: { name: string } };
  }[];

  return (
    <>
      <PageTitle
        title="Family account"
        sub="One account for every car and two-wheeler in the house. Everyone sees the same service history, and you decide who is allowed to approve spending."
      />

      {households.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <Empty
            title="No family account yet"
            body="Create one, add your vehicles to it, then invite whoever shares them. Each person keeps their own login — nobody shares a password."
            icon={<Users className="h-5 w-5" aria-hidden />}
          />
          <Panel title="Create the account" tone="brand">
            <div className="p-5">
              <ActionForm action={createHousehold} submitLabel="Create account" pendingLabel="Creating…" fullWidth>
                <Field label="What should it be called?" required hint="Something everyone will recognise.">
                  <Input name="name" required minLength={2} maxLength={80} placeholder="Sharma family — Sector 54" />
                </Field>
              </ActionForm>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="space-y-8">
          {households.map((h) => {
            const isOwner = h.created_by === user.id;
            const shared = vehicles.filter((v) => v.household_id === h.id);
            const mineUnshared = vehicles.filter((v) => v.household_id == null && v.owner_id === user.id);

            return (
              <Card key={h.id} className="rise overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
                  <div>
                    <h2 className="display-3">{h.name}</h2>
                    <p className="mt-0.5 text-[12.5px] text-ink2">
                      {h.household_members.length} {h.household_members.length === 1 ? "person" : "people"} ·{" "}
                      {shared.length} {shared.length === 1 ? "vehicle" : "vehicles"} shared · created {fmtDate(h.created_at)}
                    </p>
                  </div>
                  {isOwner && <Badge tone="brand">You manage this</Badge>}
                </div>

                <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-line">
                  <div className="p-5">
                    <Section title="Who is on it"
                      description="Anyone here can see the shared vehicles and their full service history.">
                      <ul className="space-y-2">
                        {h.household_members.map((m) => (
                          <li key={m.user_id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-4 py-3">
                            <div>
                              <p className="text-[13.5px] font-semibold">
                                {m.profiles?.full_name ?? "MEQIVA user"}
                                {m.user_id === user.id && <span className="font-normal text-ink2"> · you</span>}
                              </p>
                              <p className="mt-0.5 text-[11.5px] text-ink2">
                                {m.role === "owner" ? "Manages the account" : "Member"} · added {fmtDate(m.added_at)}
                              </p>
                            </div>
                            <Badge tone={m.can_approve ? "success" : "neutral"}>
                              {m.can_approve ? "Can approve spending" : "View and book only"}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    {isOwner && (
                      <div className="mt-5 border-t border-line pt-5">
                        <ActionForm action={addHouseholdMember} submitLabel="Add them" pendingLabel="Adding…" size="sm" resetOnSuccess>
                          <input type="hidden" name="householdId" value={h.id} />
                          <Field label="Add someone by email" required
                            hint="They need a MEQIVA account already. We never reveal whether an address is registered.">
                            <Input name="email" type="email" required placeholder="name@example.com" />
                          </Field>
                          <Check name="canApprove" label="Let them approve extra work"
                            hint="Approving means agreeing to spend money when a garage finds something mid-job." />
                        </ActionForm>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <Section title="Shared vehicles"
                      description="Everyone on the account sees these. Vehicles you keep private stay yours alone.">
                      {shared.length === 0 ? (
                        <p className="text-[13px] text-ink2">Nothing shared yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {shared.map((v) => (
                            <li key={v.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-4 py-3">
                              <div>
                                <p className="text-[13.5px] font-semibold">
                                  {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}
                                </p>
                                {v.reg_no && <p className="tnum mt-0.5 text-[11.5px] text-ink2">{v.reg_no}</p>}
                              </div>
                              {v.owner_id === user.id && (
                                <ActionButton action={shareVehicle} label="Make private" variant="ghost"
                                  hidden={{ vehicleId: v.id, householdId: "" }} />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Section>

                    {mineUnshared.length > 0 && (
                      <div className="mt-5 border-t border-line pt-5">
                        <p className="mb-2.5 text-[13px] font-semibold">Add one of yours</p>
                        <ul className="space-y-2">
                          {mineUnshared.map((v) => (
                            <li key={v.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-surface2 px-4 py-3">
                              <span className="text-[13px]">
                                {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}
                                {v.reg_no && <span className="tnum text-ink2"> · {v.reg_no}</span>}
                              </span>
                              <ActionButton action={shareVehicle} label="Share" variant="outline"
                                hidden={{ vehicleId: v.id, householdId: h.id }} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Callout tone="brand" title="Why approval is kept separate">
          A garage that finds something mid-job needs a yes from someone who can decide. Give that right to whoever
          actually settles the bill, and the rest of the family can still book a service and follow the work.
        </Callout>
        <Callout tone="neutral" title="Sharing is per vehicle, and reversible">
          A vehicle only becomes visible when you share it, and making it private again takes one tap. Service history
          stays with the vehicle either way.
        </Callout>
      </div>
    </>
  );
}
