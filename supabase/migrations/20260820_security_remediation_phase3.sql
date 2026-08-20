-- SmartBookshelf API-key input hardening
-- Existing production key lengths were verified before applying these constraints.

BEGIN;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_gemini_api_key_length
    CHECK (gemini_api_key IS NULL OR length(gemini_api_key) <= 256);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gemini_api_key_length
    CHECK (gemini_api_key IS NULL OR length(gemini_api_key) <= 256);

COMMIT;
