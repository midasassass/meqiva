-- Reference data only. Demo garages/accounts are created by `npm run seed` (scripts/seed.ts), all labelled DEMO.
insert into service_categories (slug, name, requires_diagnosis) values
 ('periodic','Periodic maintenance',false),('oil','Engine oil & filter',false),('brakes','Brake maintenance',false),
 ('battery','Battery replacement',false),('ac','AC service',false),('suspension','Suspension service',false),
 ('alignment','Wheel alignment & balancing',false),('tyres','Tyres',false),('electrical','Electrical repairs',true),
 ('diagnostics','Diagnostics',true),('engine','Engine repairs',true),('transmission','Transmission repairs',true),
 ('two_wheeler','Two-wheeler maintenance',false),('ev','EV maintenance',true),('inspection','General inspection',false),('other','Other repairs (diagnosis)',true)
on conflict do nothing;

insert into vehicle_makes (name) values ('Maruti Suzuki'),('Hyundai'),('Honda'),('Tata'),('Mahindra'),('Toyota'),('Hero'),('Royal Enfield'),('TVS') on conflict do nothing;

insert into vehicle_models (make_id, name, category)
select m.id, v.name, v.cat from (values
 ('Maruti Suzuki','Swift','hatchback'),('Maruti Suzuki','Baleno','hatchback'),('Maruti Suzuki','Dzire','sedan'),('Maruti Suzuki','Brezza','suv'),
 ('Hyundai','i20','hatchback'),('Hyundai','Creta','suv'),('Hyundai','Verna','sedan'),
 ('Honda','City','sedan'),('Honda','Amaze','sedan'),
 ('Tata','Nexon','suv'),('Tata','Punch','suv'),('Tata','Nexon EV','ev'),
 ('Mahindra','XUV700','suv'),('Mahindra','Scorpio-N','suv'),('Toyota','Innova Crysta','mpv'),
 ('Hero','Splendor','motorcycle'),('Royal Enfield','Classic 350','motorcycle'),('TVS','Jupiter','scooter')
) as v(make, name, cat) join vehicle_makes m on m.name = v.make on conflict do nothing;

insert into subscription_plans (id, name, price_paise, trial_days, max_users, max_branches, features) values
 ('starter','Starter',0,30,3,1,'{"job_cards":true,"quotes":true,"inventory":false,"insights":"rules"}'),
 ('growth','Growth',99900,30,10,1,'{"job_cards":true,"quotes":true,"inventory":true,"crm":true,"insights":"rules"}'),
 ('pro','Pro',249900,30,50,5,'{"job_cards":true,"quotes":true,"inventory":true,"crm":true,"camera":true,"insights":"ai"}')
on conflict do nothing;

-- Default platform commission: configurable by super admin. Only ever applied to marketplace-origin jobs.
insert into commission_rules (garage_id, type, rate_bps) select null, 'pct_labour', 1000 where not exists (select 1 from commission_rules where garage_id is null);

insert into feature_flags (key, enabled, note) values
 ('camera_module', false, 'Needs a streaming provider'),('whatsapp', false, 'Needs WhatsApp Business credentials'),
 ('ai_insights', false, 'Needs AI provider'),('maps', false, 'Needs maps provider key') on conflict do nothing;

-- ───────── Canonical service scope: what a quote must cover to be ranked like-for-like ─────────
insert into service_packages (category_id, slug, name, vehicle_category, required_items, optional_items, typical_minutes, applies_to)
select c.id, v.slug, v.name, v.vcat, v.req, v.opt, v.mins,
       case when v.vcat = 'motorcycle' then '{motorcycle,scooter}'::vehicle_category[]
            else '{hatchback,sedan,suv,mpv,ev}'::vehicle_category[] end
from (values
 ('oil','periodic-basic','Basic periodic service','car',
    array['Engine oil','Oil filter','Labour','Multi-point inspection'],
    array['Air filter','Cabin filter','Wheel balancing'], 90),
 ('oil','periodic-full','Comprehensive periodic service','car',
    array['Engine oil','Oil filter','Air filter','Cabin filter','Labour','Multi-point inspection','Wash'],
    array['Brake fluid top-up','Coolant top-up','Wheel alignment'], 180),
 ('brakes','brake-front','Front brake pad replacement','car',
    array['Front brake pads','Labour','Brake inspection'], array['Disc machining','Brake fluid'], 90),
 ('ac','ac-service','AC service and regas','car',
    array['Refrigerant','AC filter','Labour','Cooling performance check'], array['Condenser cleaning'], 120),
 ('battery','battery-replace','Battery replacement','car',
    array['Battery','Labour','Charging system check'], array['Terminal cleaning'], 45),
 ('alignment','align-balance','Wheel alignment and balancing','car',
    array['Four-wheel alignment','Wheel balancing','Labour'], array['Tyre rotation'], 60),
 ('two_wheeler','tw-periodic','Two-wheeler periodic service','motorcycle',
    array['Engine oil','Labour','Chain adjustment','Brake inspection'], array['Air filter','Spark plug'], 60)
) as v(cat, slug, name, vcat, req, opt, mins)
join service_categories c on c.slug = v.cat on conflict (slug) do nothing;

insert into garage_skills (name) values
 ('General mechanical'),('Engine'),('Transmission'),('Electrical'),('Air conditioning'),
 ('Denting & painting'),('Two-wheeler'),('EV high-voltage'),('Diagnostics') on conflict do nothing;

-- ───────── Platform configuration an admin can edit ─────────
insert into platform_settings (key, value, description) values
 ('billing', '{"commission_gst_bps":1800,"currency":"INR"}', 'Tax applied to the platform fee'),
 ('marketplace', '{"default_city":"Gurugram","search_radius_km":15,"max_compare":6}', 'Discovery defaults'),
 ('booking', '{"request_expiry_hours":12,"review_window_days":30}', 'Lifecycle timings'),
 ('contact', '{"support_email":"support@meqiva.example","grievance_officer":"To be appointed","grievance_email":"grievance@meqiva.example","address":"Gurugram, Haryana"}', 'Shown on legal pages — replace before launch')
on conflict (key) do nothing;

insert into seo_localities (slug, name, intro) values
 ('sector-14','Sector 14','Garages serving Sector 14 and the Old Gurugram side of the city.'),
 ('sector-29','Sector 29','Workshops around Sector 29, Leisure Valley and the surrounding sectors.'),
 ('dlf-phase-3','DLF Phase 3','Service centres covering DLF Phase 3, Cyber City and Sikanderpur.'),
 ('sohna-road','Sohna Road','Garages along Sohna Road, Badshahpur and the Southern Peripheral Road.'),
 ('golf-course-extn','Golf Course Extension','Workshops near Golf Course Extension Road and Sector 65–69.')
on conflict (slug) do nothing;

-- ───────── Help content ─────────
insert into faqs (topic, question, answer, audience, sort) values
 ('pricing','Is the price I see the final price?','The estimate shows parts, labour, consumables and tax before you book. The garage cannot bill you more than the approved amount without sending you a fresh authorisation that you accept. Anything you decline is not charged.','customer',1),
 ('pricing','What stops a garage charging above MRP on parts?','MEQIVA blocks it. For packaged goods that carry a declared MRP, the system refuses to save a quotation or invoice priced above that MRP, and logs the attempt for review. MRP includes tax, so GST is never added on top of it.','customer',2),
 ('pricing','Why are two quotes for the same service different?','Garages differ on labour rates, part brands and what the package includes. MEQIVA marks a quote as limited scope when it leaves out something the standard package covers, so a cheaper price that skips work is never shown as equivalent.','customer',3),
 ('trust','What does Verified mean?','It is a MEQIVA inspection, not a government or manufacturer certification. Listed means identity and contact details were checked. Verified adds a physical and documentary inspection of the workshop. Quality-Assured means the garage also met higher operational criteria that are reassessed periodically. Every badge shows the date it was issued and when it lapses.','customer',4),
 ('trust','Can a garage pay for a better rating?','No. Verification levels are set only by an audit and cannot be bought. Paid placement, where it appears, is labelled as sponsored and never changes a verification level or a review score.','customer',5),
 ('trust','Are the reviews real?','A review can only be written by the customer on a booking that reached completion through MEQIVA, and one booking allows one review. Reviews that came in any other way are shown separately.','customer',6),
 ('booking','What if the garage finds extra work?','Work stops and you get a new authorisation showing the reason, the parts, the labour and the revised total, with evidence where available. Nothing extra is billed until you accept it. You can decline and collect the vehicle after the approved work.','customer',7),
 ('booking','Can I cancel or reschedule?','Yes, within the cancellation window each garage sets, shown on its profile and at checkout. Cancelling after parts have been ordered for your vehicle may carry a charge, which is disclosed before you confirm.','customer',8),
 ('data','What happens to my vehicle data?','Your service history belongs to you and you can export it at any time from the vehicle page. Records created through a MEQIVA booking are marked verified; anything you upload yourself is kept separate and labelled as unverified.','customer',9),
 ('pro','Do I pay commission on my own customers?','No. Commission applies only to completed bookings that MEQIVA sent you. Walk-ins, repeat customers and fleet contract work that you manage in the software carry no marketplace fee, and the job card records which is which.','garage',1),
 ('pro','Can I use MEQIVA without taking marketplace bookings?','Yes. The workshop system — job cards, quotations, inventory, CRM, invoicing and reporting — works on its own. Marketplace listing is an option you switch on when you want it.','garage',2),
 ('pro','How much of this can I change for my garage?','Branding and colour, working hours and holidays, service catalogue and prices, labour rate cards, job card fields, inspection checklists, booking rules, deposits, cancellation terms, invoice format and tax settings, warranty wording, notification templates, staff roles and branches.','garage',3),
 ('pro','What happens to my data if I leave?','You can export your customers, vehicles, job cards and invoices at any time. Closing the account does not delete records the law requires to be retained, such as tax invoices.','garage',4)
on conflict do nothing;

insert into cms_pages (slug, title, meta_description, body) values
 ('about','About MEQIVA','Why MEQIVA exists and how it works.',
'MEQIVA was built around one ordinary problem: in most of India you agree to a repair before you know what it costs.

A workshop is not usually trying to cheat anyone. The estimate is genuinely hard to give on the spot, the parts catalogue lives in a supplier''s head, and the bill gets assembled at the end. The customer experiences that as a number they cannot check.

So MEQIVA puts the itemised estimate first, and makes the software that produces it good enough that a garage would want it even with no marketplace attached. The marketplace is a way to find customers. The workshop system is the product.

Three rules sit underneath everything:

A price above the printed MRP cannot be saved. Not as a warning, not as an override — the quotation and the invoice are both refused.

Extra work needs a fresh authorisation. A technician cannot add billable work to your job; the customer sees the reason, the parts, the labour and the new total, and either accepts or declines.

Verification is earned, never sold. Inspection levels are set by audit and carry the date they were issued.

MEQIVA is operated from Gurugram, Haryana, and is expanding across India.'),
 ('terms','Terms of use','The agreement between you and MEQIVA.',
'These terms are a working draft and must be reviewed by qualified counsel before MEQIVA accepts a paying customer.

**What MEQIVA is.** MEQIVA operates an online platform that lists independent automotive service businesses and provides software those businesses use to run their workshops. MEQIVA is an intermediary. The repair contract is between the customer and the garage.

**Who does the work.** The garage performs the service, issues the tax invoice and owns the workmanship warranty. MEQIVA does not repair vehicles and does not guarantee repairs on a garage''s behalf.

**Estimates and approval.** An estimate is not a binding work order until the customer approves it. Work beyond an approved scope requires a fresh approval. Indicative ranges shown before a diagnosis are marked as such.

**Pricing rules.** Garages set their own prices. For packaged goods carrying a declared MRP, the platform refuses prices above that MRP. MRP is inclusive of tax.

**Payments.** Payments are processed by a regulated payment partner. MEQIVA does not hold customer funds on its own account.

**Reviews.** Reviews may be submitted only by the customer on a completed booking. MEQIVA may remove a review that breaks these terms, and a garage may dispute one.

**Liability.** Nothing here limits rights available to a consumer under the Consumer Protection Act, 2019.

**Governing law.** The laws of India, with courts at Gurugram, Haryana.'),
 ('privacy','Privacy policy','What MEQIVA collects and why.',
'This notice is a working draft and must be reviewed against the Digital Personal Data Protection Act, 2023 and its rules before launch.

**What is collected.** Your name, phone number and email; your vehicles and their service history; bookings, quotations, approvals and invoices; and, where you grant it, approximate location to find garages near you.

**Why.** To show you accurate prices, let a garage carry out work you asked for, keep a record you can check later, and meet tax and accounting obligations.

**Who sees it.** The garage you book with sees what it needs to do the work. It cannot see any other garage''s customers, and no other garage can see you. Payment details go to the payment partner, never to MEQIVA.

**Camera sessions.** Where a live view is offered, access is limited to your own service session, requires consent, expires automatically and is logged.

**Communication.** Service messages about your booking are sent because you have a booking. Marketing messages require separate consent you can withdraw.

**Your rights.** You can access, correct and export your data from your account, and ask for deletion subject to records the law requires to be kept.

**Grievances.** The grievance officer''s name and contact appear on the grievance page and must be appointed before launch.'),
 ('grievance','Grievance redressal','How to escalate a complaint.',
'**Step one — raise it with the garage.** Open the booking and start a ticket. The garage is notified and most issues close here.

**Step two — escalate to MEQIVA.** If there is no response within three working days, or the response does not resolve it, escalate from the same ticket. A MEQIVA support agent takes it up, can request evidence from both sides and records the outcome.

**Step three — the grievance officer.** A complaint that remains unresolved is referred to the grievance officer, who must respond within the period the applicable rules require. The officer''s name, address and email must be published here before launch.

**What MEQIVA can do.** Mediate, require a garage to re-do work under its warranty, coordinate a refund through the payment partner, and suspend a garage. What MEQIVA cannot do is decide a legal dispute between you and the garage, or pay a claim it has not agreed to underwrite.

Nothing here affects your right to approach a consumer forum.')
on conflict (slug) do nothing;

-- ───────── Optional extras a customer can add to an estimate ─────────
insert into addon_catalog (slug, name, description, category_id, sort)
select v.slug, v.name, v.descr, c.id, v.sort from (values
 ('wheel-alignment','Wheel alignment','Four-wheel alignment check and adjustment','alignment',1),
 ('wheel-balancing','Wheel balancing','Balance all four wheels','alignment',2),
 ('ac-filter','Cabin AC filter','Replace the cabin air filter','ac',3),
 ('ac-regas','AC gas top-up','Refrigerant top-up and leak check','ac',4),
 ('brake-fluid','Brake fluid change','Drain and replace brake fluid','brakes',5),
 ('coolant-flush','Coolant flush','Drain, flush and refill coolant','periodic',6),
 ('wiper-blades','Wiper blades','Replace front wiper blades','periodic',7),
 ('battery-check','Battery and charging check','Load test and charging system check','battery',8),
 ('interior-detail','Interior deep clean','Vacuum, shampoo and dashboard treatment','periodic',9),
 ('headlight-restore','Headlight restoration','Polish and seal clouded headlamps','periodic',10)
) as v(slug, name, descr, cat, sort)
join service_categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- ═════════ Trust layer reference data (migration 0008) ═════════

insert into credential_types (slug, name, issuer, description, sort) values
 ('iti-mmv','ITI — Mechanic Motor Vehicle','National Council for Vocational Training','Two-year trade certificate in motor vehicle mechanics.',1),
 ('diploma-auto','Diploma in Automobile Engineering','State board of technical education','Three-year diploma covering vehicle systems and diagnostics.',2),
 ('oem-trained','Manufacturer-trained technician',null,'Completed a vehicle manufacturer''s own training programme.',3),
 ('ev-hv','EV high-voltage safety',null,'Certified to work safely on high-voltage electric vehicle systems.',4),
 ('ac-refrigerant','Air-conditioning and refrigerant handling',null,'Trained in refrigerant recovery, charging and safe handling.',5),
 ('wheel-align','Wheel alignment and suspension geometry',null,'Equipment-specific training on alignment systems.',6),
 ('diagnostics','Electronic diagnostics',null,'Scan tool and fault-tracing training for modern engine management.',7)
on conflict (slug) do nothing;

-- Manufacturer-style service intervals, used by the cost forecast.
insert into maintenance_schedules (vehicle_category, package_id, every_months, every_km, from_km, note)
select v.cat, sp.id, v.months, v.km, v.from_km, v.note from (values
 ('hatchback','periodic-basic',12,10000,0,'Routine oil and filter service.'),
 ('sedan','periodic-basic',12,10000,0,'Routine oil and filter service.'),
 ('suv','periodic-basic',12,10000,0,'Routine oil and filter service.'),
 ('mpv','periodic-basic',12,10000,0,'Routine oil and filter service.'),
 ('hatchback','periodic-full',24,20000,20000,'Fuller service, usually alternate years.'),
 ('sedan','periodic-full',24,20000,20000,'Fuller service, usually alternate years.'),
 ('suv','periodic-full',24,20000,20000,'Fuller service, usually alternate years.'),
 ('hatchback','brake-front',null,40000,30000,'Front pads typically need replacing in this range.'),
 ('sedan','brake-front',null,40000,30000,'Front pads typically need replacing in this range.'),
 ('suv','brake-front',null,35000,30000,'Heavier vehicles wear front pads sooner.'),
 ('hatchback','ac-service',24,null,0,'Cooling performance drops gradually; check before summer.'),
 ('sedan','ac-service',24,null,0,'Cooling performance drops gradually; check before summer.'),
 ('suv','ac-service',24,null,0,'Cooling performance drops gradually; check before summer.'),
 ('hatchback','align-balance',null,10000,0,'After pothole season or new tyres.'),
 ('sedan','align-balance',null,10000,0,'After pothole season or new tyres.'),
 ('suv','align-balance',null,10000,0,'After pothole season or new tyres.'),
 ('hatchback','battery-replace',48,null,0,'Most batteries last three to five years in Delhi NCR heat.'),
 ('sedan','battery-replace',48,null,0,'Most batteries last three to five years in Delhi NCR heat.'),
 ('suv','battery-replace',48,null,0,'Most batteries last three to five years in Delhi NCR heat.'),
 ('motorcycle','tw-periodic',6,5000,0,'Two-wheelers need servicing more often.'),
 ('scooter','tw-periodic',6,4000,0,'Two-wheelers need servicing more often.')
) as v(cat, slug, months, km, from_km, note)
join service_packages sp on sp.slug = v.slug
on conflict do nothing;

insert into inspection_packages (slug, name, description, vehicle_category, checkpoints, price_paise, duration_minutes) values
 ('preowned-essential','Essential pre-purchase check','Engine, gearbox, brakes, suspension, electricals and a road test. Photographs of every fault found.',null,90,149900,75),
 ('preowned-complete','Complete pre-purchase inspection','Everything in the essential check plus paint-thickness readings on every panel, underbody inspection on a lift, scan-tool fault report and an accident-history opinion.',null,160,249900,150),
 ('preowned-ev','Electric vehicle inspection','Battery state-of-health estimate, charging behaviour, high-voltage safety checks and the usual mechanical inspection.','ev',120,299900,150)
on conflict (slug) do nothing;

-- Roadside directory. These are PLACEHOLDERS so the page renders in a demonstration: the
-- numbers are not real and no partnership exists. None of them carries a verified_at, so
-- the public page labels every one "Not yet checked". Delete them and add operators you
-- have actually rung before launch.
insert into assistance_partners (name, kinds, phone, city, localities, hours, notes, active, sort) values
 ('Sample listing — towing and recovery, Gurugram South','{towing,accident}','18001200000','Gurugram','{"Sector 29","Sohna Road","Golf Course Extension"}','24 hours','Placeholder entry, not a real operator. Replace before launch.',true,1),
 ('Sample listing — battery and lockout assist','{battery,lockout}','18001200001','Gurugram','{"Sector 14","DLF Phase 3","Sector 29"}','7am to 11pm','Placeholder entry, not a real operator. Replace before launch.',true,2),
 ('Sample listing — tyre and puncture assist','{tyre}','18001200002','Gurugram','{"Sohna Road","Sector 65"}','24 hours','Placeholder entry, not a real operator. Replace before launch.',true,3),
 ('Sample listing — emergency fuel delivery','{fuel}','18001200003','Gurugram','{"Gurugram"}','6am to midnight','Placeholder entry, not a real operator. Replace before launch.',true,4),
 ('Sample listing — EV recovery and charging','{ev_charge,towing}','18001200004','Gurugram','{"Cyber City","Golf Course Road"}','24 hours','Placeholder entry, not a real operator. Replace before launch.',true,5)
on conflict do nothing;

insert into feature_flags (key, enabled, note) values
 ('repair_review', true, 'Independent second opinion on a quoted repair'),
 ('second_quote', true, 'Request another workshop estimate'),
 ('preowned_inspection', true, 'Pre-purchase inspection orders'),
 ('assistance_directory', true, 'Roadside and recovery directory'),
 ('household_accounts', true, 'Share vehicles with family')
on conflict (key) do nothing;

insert into platform_settings (key, value, description) values
 ('trust', '{"repair_review_sla_hours":24,"second_quote_window_hours":72,"warranty_reminder_days":14}',
  'Timings for the independent review and second-quote features')
on conflict (key) do nothing;
