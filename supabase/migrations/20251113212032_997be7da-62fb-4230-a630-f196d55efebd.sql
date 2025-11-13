-- Create financial_analysis table for AI insights
CREATE TABLE IF NOT EXISTS public.financial_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  health_score INTEGER,
  trend TEXT,
  insights JSONB,
  predictions JSONB,
  recommendations JSONB,
  alerts JSONB,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tasks_executed INTEGER,
  tasks_succeeded INTEGER,
  tasks_failed INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all authenticated users to read)
CREATE POLICY "Allow authenticated users to view financial analysis"
ON public.financial_analysis FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view automation logs"
ON public.automation_logs FOR SELECT
USING (auth.role() = 'authenticated');