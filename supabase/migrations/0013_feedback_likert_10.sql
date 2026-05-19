-- =====================================================================
-- 0013: Feedback ratings change from 1-5 (stars) to 1-10 (Likert scale)
-- Drops every existing check constraint on feedback and re-adds with 1-10 range.
-- =====================================================================

do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.feedback'::regclass and contype = 'c'
  loop
    execute 'alter table public.feedback drop constraint ' || quote_ident(c);
  end loop;
end $$;

alter table public.feedback
  add constraint feedback_grammar_accuracy_check     check (grammar_accuracy     between 1 and 10),
  add constraint feedback_grammar_complexity_check   check (grammar_complexity   between 1 and 10),
  add constraint feedback_vocabulary_diversity_check check (vocabulary_diversity between 1 and 10),
  add constraint feedback_vocabulary_relevancy_check check (vocabulary_relevancy between 1 and 10),
  add constraint feedback_comprehension_check        check (comprehension        between 1 and 10),
  add constraint feedback_content_clarity_check      check (content_clarity      between 1 and 10),
  add constraint feedback_content_organization_check check (content_organization between 1 and 10),
  add constraint feedback_participation_check        check (participation        between 1 and 10),
  add constraint feedback_tone_manner_check          check (tone_manner          between 1 and 10),
  add constraint feedback_preparation_check          check (preparation          between 1 and 10);
