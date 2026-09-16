-- Two changes, both from a product review of what was actually earning its
-- keep:
--
-- 1. The on-device AI photo-classification feature (migration 0015) is
--    removed. It ran a general-purpose 1000-class ImageNet model
--    (unrelated to donation triage) and pattern-matched the result against
--    a hardcoded keyword list -- real accuracy for the 4 donation
--    categories was never validated, the category field was still
--    required either way (so it saved at most one click when right), and
--    it shipped a multi-megabyte model to the donor's phone to do it. Not
--    worth the mobile-data cost on this market for the value delivered.
-- 2. The water/CO2/landfill impact formula (migration 0012) scaled its
--    category-level estimate by the donor-reported condition percentage.
--    That doesn't correspond to anything physical -- the environmental
--    cost of having produced an item doesn't change based on how worn it
--    looks -- so the multiplier is dropped. Impact is now a flat,
--    disclosed, category-level estimate (see the Impact page for the
--    methodology note and citations).

alter table public.donations drop column ai_suggested_category;
alter table public.donations drop column ai_confidence;

create or replace function public.compute_donation_impact()
returns trigger
language plpgsql
as $$
declare
  base_water numeric;
  base_co2 numeric;
  base_landfill numeric;
begin
  if new.category = 'clothing' then
    base_water := 3000; base_co2 := 3; base_landfill := 0.05;
  elsif new.category = 'shoes' then
    base_water := 1500; base_co2 := 2; base_landfill := 0.03;
  elsif new.category = 'accessories' then
    base_water := 800; base_co2 := 1; base_landfill := 0.02;
  else
    base_water := 500; base_co2 := 0.5; base_landfill := 0.01;
  end if;

  new.impact_water_l := base_water;
  new.impact_co2_kg := base_co2;
  new.impact_landfill_m3 := base_landfill;
  return new;
end;
$$;
