-- Allow SECURITY DEFINER functions to work with trips RLS

ALTER TABLE public.trips NO FORCE ROW LEVEL SECURITY;
