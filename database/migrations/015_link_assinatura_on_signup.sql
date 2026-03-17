-- Migration: 015_link_assinatura_on_signup.sql
-- Update trigger to link assinaturas.doctor_id when a new doctor account is created.
-- When a user pays, the assinaturas record is created with email but no doctor_id.
-- This update populates doctor_id using the email match after the medicos record is created.

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_medicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_clinica_id uuid;
  v_medico_id uuid;
BEGIN
  -- Try to resolve a display name from auth metadata
  v_name := COALESCE(
    (NEW.raw_user_meta_data->>'name'),
    (NEW.raw_user_meta_data->>'full_name'),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  -- Get role from metadata (default to 'doctor' if null)
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'doctor');

  -- Logic for Clinic Registration
  IF v_role = 'clinic' THEN
    -- 1. Create entry in 'clinicas' table
    INSERT INTO public.clinicas (user_auth, nome, email, created_at)
    VALUES (NEW.id, v_name, NEW.email, now())
    RETURNING id INTO v_clinica_id;

    -- 2. Create entry in 'medicos' table LINKED to this clinic
    INSERT INTO public.medicos (email, name, user_auth, clinica_id, is_doctor, clinica_admin)
    VALUES (NEW.email, v_name, NEW.id, v_clinica_id, true, true)
    ON CONFLICT (email) DO NOTHING;

  ELSE
    -- Logic for Independent Doctor
    INSERT INTO public.medicos (email, name, user_auth, is_doctor)
    VALUES (NEW.email, v_name, NEW.id, true)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  -- Retrieve the medicos.id for the newly created doctor
  SELECT id INTO v_medico_id
  FROM public.medicos
  WHERE user_auth = NEW.id
  LIMIT 1;

  -- Link assinaturas record to the new doctor using email match
  IF v_medico_id IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.assinaturas
    SET doctor_id = v_medico_id
    WHERE email = lower(trim(NEW.email))
      AND doctor_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
