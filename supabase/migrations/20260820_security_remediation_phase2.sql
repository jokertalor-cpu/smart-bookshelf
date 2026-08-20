-- SmartBookshelf security remediation phase 2
-- Prevent self-service role escalation while preserving safe profile metadata updates.

BEGIN;

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Table-level UPDATE would make every profile column writable, including role and API-key fields.
-- Regrant only the metadata columns that a normal profile editor may safely change.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON TABLE public.profiles TO authenticated;
REVOKE ALL ON TABLE public.profiles, public.user_accounts, public.user_downloads,
  public.user_likes, public.user_progress, public.user_settings, public.provider_links,
  public.login_history FROM anon;

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_progress_percent_range
    CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  ADD CONSTRAINT user_progress_last_page_nonnegative
    CHECK (last_page IS NULL OR last_page >= 0),
  ADD CONSTRAINT user_progress_total_pages_nonnegative
    CHECK (total_pages IS NULL OR total_pages >= 0);

-- These buckets are not used by the current Admin upload UI, but explicit limits prevent
-- future unbounded uploads while preserving current public reads/downloads.
UPDATE storage.buckets
SET file_size_limit = 104857600,
    allowed_mime_types = ARRAY['application/zip', 'application/octet-stream']
WHERE id = 'ai-bucket';

UPDATE storage.buckets
SET file_size_limit = 209715200,
    allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
WHERE id = 'APK file';

COMMIT;
