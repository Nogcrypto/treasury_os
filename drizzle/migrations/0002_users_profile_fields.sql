-- Migration: add profile fields to public.users
-- Run this in Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT,
  ADD COLUMN IF NOT EXISTS country   TEXT;
