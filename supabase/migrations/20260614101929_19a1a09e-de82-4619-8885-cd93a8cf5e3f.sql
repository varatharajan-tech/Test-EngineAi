-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  units TEXT NOT NULL DEFAULT 'SI',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.fuels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  calorific_value NUMERIC NOT NULL,
  density NUMERIC NOT NULL,
  air_fuel_ratio NUMERIC NOT NULL,
  octane_number NUMERIC,
  cetane_number NUMERIC,
  latent_heat NUMERIC,
  flash_point NUMERIC,
  viscosity NUMERIC,
  carbon_fraction NUMERIC NOT NULL DEFAULT 0.86,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuels TO authenticated;
GRANT ALL ON public.fuels TO service_role;
ALTER TABLE public.fuels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuels read" ON public.fuels FOR SELECT TO authenticated USING (is_preset OR auth.uid() = user_id);
CREATE POLICY "fuels insert" ON public.fuels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_preset);
CREATE POLICY "fuels update" ON public.fuels FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_preset);
CREATE POLICY "fuels delete" ON public.fuels FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_preset);
CREATE TRIGGER trg_fuels_updated BEFORE UPDATE ON public.fuels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  engine_type TEXT NOT NULL,
  cylinders INT NOT NULL,
  bore NUMERIC NOT NULL,
  stroke NUMERIC NOT NULL,
  compression_ratio NUMERIC NOT NULL,
  conn_rod_length NUMERIC,
  displacement NUMERIC,
  cooling TEXT NOT NULL DEFAULT 'water',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engines TO authenticated;
GRANT ALL ON public.engines TO service_role;
ALTER TABLE public.engines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engines read" ON public.engines FOR SELECT TO authenticated USING (is_preset OR auth.uid() = user_id);
CREATE POLICY "engines insert" ON public.engines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_preset);
CREATE POLICY "engines update" ON public.engines FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT is_preset);
CREATE POLICY "engines delete" ON public.engines FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT is_preset);
CREATE TRIGGER trg_engines_updated BEFORE UPDATE ON public.engines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fuel_id UUID NOT NULL REFERENCES public.fuels ON DELETE RESTRICT,
  engine_id UUID NOT NULL REFERENCES public.engines ON DELETE RESTRICT,
  rpm INT NOT NULL,
  load_pct NUMERIC NOT NULL,
  ambient_temp NUMERIC NOT NULL DEFAULT 25,
  intake_temp NUMERIC NOT NULL DEFAULT 30,
  intake_pressure NUMERIC NOT NULL DEFAULT 1.013,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim owner" ON public.simulations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.simulation_results (
  simulation_id UUID PRIMARY KEY REFERENCES public.simulations ON DELETE CASCADE,
  torque NUMERIC, brake_power NUMERIC, indicated_power NUMERIC,
  fuel_consumption NUMERIC, bsfc NUMERIC,
  thermal_efficiency NUMERIC, mechanical_efficiency NUMERIC, volumetric_efficiency NUMERIC,
  co NUMERIC, co2 NUMERIC, hc NUMERIC, nox NUMERIC, smoke NUMERIC,
  confidence NUMERIC,
  curve JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_results TO authenticated;
GRANT ALL ON public.simulation_results TO service_role;
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim results owner" ON public.simulation_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulations s WHERE s.id = simulation_id AND s.user_id = auth.uid()));

CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT,
  record_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  columns text[] NOT NULL DEFAULT '{}',
  preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_type text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "datasets owner" ON public.datasets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.simulations ON DELETE CASCADE,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports owner" ON public.reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv owner" ON public.assistant_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg owner" ON public.assistant_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assistant_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assistant_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

INSERT INTO public.fuels (is_preset, name, fuel_type, calorific_value, density, air_fuel_ratio, octane_number, cetane_number, latent_heat, flash_point, viscosity, carbon_fraction) VALUES
(true,'Petrol (Gasoline)','petrol',44.0,745,14.7,95,NULL,305,-43,0.6,0.866),
(true,'Diesel','diesel',42.5,830,14.5,NULL,51,250,65,2.8,0.866),
(true,'Biodiesel (B100)','biodiesel',37.5,880,12.5,NULL,54,200,150,4.5,0.770),
(true,'Ethanol (E100)','ethanol',26.9,789,9.0,108,NULL,904,13,1.2,0.521),
(true,'Methanol','methanol',19.9,791,6.5,109,NULL,1100,11,0.6,0.375),
(true,'Hydrogen (H2)','hydrogen',120.0,0.0899,34.3,130,NULL,461,-253,0.01,0.0),
(true,'LPG (Propane)','lpg',46.4,508,15.7,112,NULL,425,-104,0.2,0.818),
(true,'LNG','lng',49.0,450,17.2,120,NULL,510,-188,0.1,0.750),
(true,'CNG (Methane)','cng',50.0,0.717,17.2,120,NULL,510,-188,0.01,0.750),
(true,'B20 Biodiesel Blend','biodiesel',41.5,840,13.9,NULL,52,260,80,3.1,0.847);

INSERT INTO public.engines (is_preset, name, engine_type, cylinders, bore, stroke, compression_ratio, conn_rod_length, displacement, cooling) VALUES
(true,'Standard 4-Cyl 2.0L SI','SI',4,83,92,10.5,145,2.0,'water'),
(true,'V6 3.5L Twin-Turbo SI','SI',6,92,86,10.0,150,3.5,'water'),
(true,'4-Cyl 2.2L CI Diesel','CI',4,86,94,17.5,150,2.2,'water'),
(true,'Single-Cyl Research Engine','CI',1,87.5,110,17.5,234,0.661,'water'),
(true,'V8 5.0L SI Performance','SI',8,93,92,11.0,160,5.0,'water'),
(true,'3-Cyl 1.0L Eco SI','SI',3,71.9,82,11.5,130,1.0,'water');

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;