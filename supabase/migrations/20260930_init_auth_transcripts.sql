-- ============================================================================
-- Supabase Migration: 20260930_init_auth_transcripts.sql
-- Multi-Tenant Authentication, Persistent Transcripts, and Row-Level Security
-- ============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. User Profiles Table (Mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatic Profile Creation Trigger on Supabase Sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Transcripts Table (Replaces browser localStorage)
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Recording',
    audio_path TEXT,                         -- Storage path: user_recordings/{user_id}/{filename}
    duration_seconds NUMERIC(8, 2) NOT NULL DEFAULT 0.0,
    confidence NUMERIC(4, 3) DEFAULT NULL,
    full_transcript TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'nova-3',
    language TEXT DEFAULT 'en',
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    raw_response JSONB DEFAULT '{}'::jsonb,  -- Full Deepgram JSON payload
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON public.transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON public.transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_fts ON public.transcripts USING GIN (to_tsvector('english', full_transcript));

-- 4. Automatic updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_transcripts_modtime ON public.transcripts;
CREATE TRIGGER update_transcripts_modtime
    BEFORE UPDATE ON public.transcripts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Transcripts CRUD Isolation Policies
DROP POLICY IF EXISTS "Users can view their own transcripts" ON public.transcripts;
CREATE POLICY "Users can view their own transcripts"
    ON public.transcripts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own transcripts" ON public.transcripts;
CREATE POLICY "Users can create their own transcripts"
    ON public.transcripts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.transcripts;
CREATE POLICY "Users can update their own transcripts"
    ON public.transcripts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own transcripts" ON public.transcripts;
CREATE POLICY "Users can delete their own transcripts"
    ON public.transcripts FOR DELETE
    USING (auth.uid() = user_id);

-- Storage Bucket RLS Policies for "audio-recordings"
-- Enforces object paths: user_recordings/{user_id}/*

DROP POLICY IF EXISTS "Users can upload their own audio files" ON storage.objects;
CREATE POLICY "Users can upload their own audio files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'audio-recordings' AND
        auth.uid()::text = (storage.foldername(name))[2]
    );

DROP POLICY IF EXISTS "Users can read their own audio files" ON storage.objects;
CREATE POLICY "Users can read their own audio files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'audio-recordings' AND
        auth.uid()::text = (storage.foldername(name))[2]
    );

DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;
CREATE POLICY "Users can delete their own audio files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'audio-recordings' AND
        auth.uid()::text = (storage.foldername(name))[2]
    );
