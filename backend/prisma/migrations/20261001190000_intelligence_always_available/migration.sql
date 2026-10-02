ALTER TABLE public."Company"
ALTER COLUMN intelligence_enabled SET DEFAULT true;

UPDATE public."Company"
SET intelligence_enabled = true
WHERE intelligence_enabled = false;
