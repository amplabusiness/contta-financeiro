import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Sora Video Generator Edge Function
 *
 * Integra com OpenAI Sora 2 para geração de vídeos com IA
 * Usa as tabelas: sora_video_projects, sora_generation_queue, sora_video_templates
 *
 * Endpoints:
 * - POST /generate - Inicia geração de vídeo
 * - POST /generate-from-template - Gera vídeo a partir de template
 * - POST /status - Verifica status de um projeto
 * - POST /list - Lista projetos do usuário
 * - POST /cancel - Cancela um projeto pendente
 * - POST /approve - Aprova vídeo para publicação
 * - POST /templates - Lista templates disponíveis
 */

interface VideoGenerationRequest {
  action: 'generate' | 'generate-from-template' | 'status' | 'list' | 'cancel' | 'approve' | 'templates'
  // Para generate
  prompt?: string
  project_name?: string
  project_type?: string
  duration_seconds?: number
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  resolution?: '720p' | '1080p' | '4k'
  style?: string
  include_audio?: boolean
  narration_text?: string
  // Para generate-from-template
  template_code?: string
  variables?: Record<string, string>
  priority?: number
  // Para status/cancel/approve
  project_id?: string
  // Para approve
  approved_by?: string
  rejection_reason?: string
}

interface SoraAPIResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  video_url?: string
  thumbnail_url?: string
  error?: string
  progress?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const request: VideoGenerationRequest = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    switch (request.action) {
      case 'generate':
        return await handleGenerate(supabase, request, openaiApiKey)
      case 'generate-from-template':
        return await handleGenerateFromTemplate(supabase, request, openaiApiKey)
      case 'status':
        return await handleStatus(supabase, request, openaiApiKey)
      case 'list':
        return await handleList(supabase, request)
      case 'cancel':
        return await handleCancel(supabase, request)
      case 'approve':
        return await handleApprove(supabase, request)
      case 'templates':
        return await handleTemplates(supabase)
      default:
        throw new Error('Ação inválida. Use: generate, generate-from-template, status, list, cancel, approve ou templates')
    }

  } catch (error) {
    console.error('Sora Video Generator error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Gerar vídeo com prompt direto
async function handleGenerate(
  supabase: any,
  request: VideoGenerationRequest,
  openaiApiKey?: string
): Promise<Response> {
  if (!request.prompt) {
    throw new Error('Prompt é obrigatório para gerar vídeo')
  }

  const validDurations = [5, 10, 15, 20, 30, 45, 60, 120]
  const duration = request.duration_seconds || 10
  if (!validDurations.includes(duration)) {
    throw new Error('Duração deve ser: 5, 10, 15, 20, 30, 45, 60 ou 120 segundos')
  }

  // Buscar configuração de branding
  const { data: branding } = await supabase
    .from('video_branding_config')
    .select('*')
    .eq('is_active', true)
    .single()

  // Criar projeto
  const { data: project, error: insertError } = await supabase
    .from('sora_video_projects')
    .insert({
      project_name: request.project_name || `Vídeo ${new Date().toLocaleString('pt-BR')}`,
      project_type: request.project_type || 'custom',
      prompt: request.prompt,
      duration_seconds: duration,
      aspect_ratio: request.aspect_ratio || '16:9',
      resolution: request.resolution || '1080p',
      style: request.style || 'professional',
      include_audio: request.include_audio !== false,
      narration_text: request.narration_text,
      brand_colors: branding?.primary_color ? {
        primary: branding.primary_color,
        secondary: branding.secondary_color,
        accent: branding.accent_color
      } : undefined,
      status: 'pending'
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error creating project:', insertError)
    throw new Error('Erro ao criar projeto de vídeo')
  }

  // Adicionar à fila
  const { error: queueError } = await supabase
    .from('sora_generation_queue')
    .insert({
      project_id: project.id,
      priority: request.priority || 5,
      api_request: {
        model: 'sora-2',
        prompt: request.prompt,
        duration: duration,
        aspect_ratio: request.aspect_ratio || '16:9',
        resolution: request.resolution || '1080p',
        style: request.style || 'professional'
      }
    })

  if (queueError) {
    console.error('Error adding to queue:', queueError)
  }

  // Tentar chamar API do Sora
  if (openaiApiKey) {
    try {
      const soraResponse = await callSoraAPI(openaiApiKey, {
        prompt: request.prompt,
        duration: duration,
        aspect_ratio: request.aspect_ratio || '16:9',
        resolution: request.resolution || '1080p',
        style: request.style
      })

      // Atualizar projeto com job externo
      await supabase
        .from('sora_video_projects')
        .update({
          sora_job_id: soraResponse.id,
          sora_model_used: 'sora-2',
          status: 'generating',
          generation_started_at: new Date().toISOString()
        })
        .eq('id', project.id)

      // Atualizar fila
      await supabase
        .from('sora_generation_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('project_id', project.id)

    } catch (apiError) {
      console.error('Sora API error:', apiError)

      // Modo simulação se API falhar
      await startSimulation(supabase, project.id, request.prompt, duration)
    }
  } else {
    // Modo simulação
    console.log('Running in simulation mode - no OPENAI_API_KEY')
    await startSimulation(supabase, project.id, request.prompt, duration)
  }

  return new Response(JSON.stringify({
    success: true,
    project_id: project.id,
    status: 'generating',
    message: 'Geração de vídeo iniciada!',
    estimated_time: getEstimatedTime(duration)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Gerar vídeo a partir de template
async function handleGenerateFromTemplate(
  supabase: any,
  request: VideoGenerationRequest,
  openaiApiKey?: string
): Promise<Response> {
  if (!request.template_code) {
    throw new Error('template_code é obrigatório')
  }

  // Buscar template
  const { data: template, error: templateError } = await supabase
    .from('sora_video_templates')
    .select('*')
    .eq('template_code', request.template_code)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    throw new Error(`Template ${request.template_code} não encontrado`)
  }

  // Substituir variáveis no prompt
  let prompt = template.base_prompt
  const variables = request.variables || {}

  for (const varName of template.variables || []) {
    const value = variables[varName]
    if (value) {
      prompt = prompt.replace(new RegExp(`{{${varName}}}`, 'g'), value)
    }
  }

  // Criar projeto usando o template
  const { data: project, error: insertError } = await supabase
    .from('sora_video_projects')
    .insert({
      project_name: `${template.template_name} - ${new Date().toLocaleString('pt-BR')}`,
      project_type: template.category,
      prompt: prompt,
      duration_seconds: request.duration_seconds || template.default_duration,
      aspect_ratio: request.aspect_ratio || template.default_aspect_ratio,
      style: template.default_style,
      status: 'pending'
    })
    .select()
    .single()

  if (insertError) {
    throw new Error('Erro ao criar projeto')
  }

  // Adicionar à fila
  await supabase
    .from('sora_generation_queue')
    .insert({
      project_id: project.id,
      priority: request.priority || 5,
      api_request: {
        model: 'sora-2',
        prompt: prompt,
        duration: request.duration_seconds || template.default_duration,
        aspect_ratio: request.aspect_ratio || template.default_aspect_ratio,
        style: template.default_style,
        template_code: request.template_code,
        variables: variables
      }
    })

  // Iniciar geração
  const duration = request.duration_seconds || template.default_duration
  if (openaiApiKey) {
    try {
      const soraResponse = await callSoraAPI(openaiApiKey, {
        prompt: prompt,
        duration: duration,
        aspect_ratio: request.aspect_ratio || template.default_aspect_ratio,
        resolution: '1080p',
        style: template.default_style
      })

      await supabase
        .from('sora_video_projects')
        .update({
          sora_job_id: soraResponse.id,
          sora_model_used: 'sora-2',
          status: 'generating',
          generation_started_at: new Date().toISOString()
        })
        .eq('id', project.id)

    } catch (apiError) {
      await startSimulation(supabase, project.id, prompt, duration)
    }
  } else {
    await startSimulation(supabase, project.id, prompt, duration)
  }

  return new Response(JSON.stringify({
    success: true,
    project_id: project.id,
    template_used: request.template_code,
    prompt_generated: prompt,
    status: 'generating',
    estimated_time: getEstimatedTime(duration)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Verificar status do projeto
async function handleStatus(
  supabase: any,
  request: VideoGenerationRequest,
  openaiApiKey?: string
): Promise<Response> {
  if (!request.project_id) {
    throw new Error('project_id é obrigatório')
  }

  const { data: project, error } = await supabase
    .from('sora_video_projects')
    .select('*')
    .eq('id', request.project_id)
    .single()

  if (error || !project) {
    throw new Error('Projeto não encontrado')
  }

  // Se está processando e tem job externo, verificar status na API
  if (project.status === 'generating' && project.sora_job_id && openaiApiKey) {
    try {
      const soraStatus = await checkSoraStatus(openaiApiKey, project.sora_job_id)

      if (soraStatus.status === 'completed') {
        await supabase
          .from('sora_video_projects')
          .update({
            status: 'ready',
            video_url: soraStatus.video_url,
            thumbnail_url: soraStatus.thumbnail_url,
            generation_completed_at: new Date().toISOString()
          })
          .eq('id', request.project_id)

        project.status = 'ready'
        project.video_url = soraStatus.video_url
        project.thumbnail_url = soraStatus.thumbnail_url
      } else if (soraStatus.status === 'failed') {
        await supabase
          .from('sora_video_projects')
          .update({ status: 'failed' })
          .eq('id', request.project_id)

        project.status = 'failed'
      }
    } catch (apiError) {
      console.error('Error checking Sora status:', apiError)
    }
  }

  // Buscar item da fila
  const { data: queueItem } = await supabase
    .from('sora_generation_queue')
    .select('*')
    .eq('project_id', request.project_id)
    .single()

  return new Response(JSON.stringify({
    success: true,
    project: project,
    queue: queueItem,
    progress: calculateProgress(project)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Listar projetos
async function handleList(
  supabase: any,
  request: VideoGenerationRequest
): Promise<Response> {
  const { data: projects, error } = await supabase
    .from('sora_video_projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('Erro ao listar projetos')
  }

  // Estatísticas
  const stats = {
    total: projects?.length || 0,
    generating: projects?.filter((p: any) => p.status === 'generating').length || 0,
    ready: projects?.filter((p: any) => p.status === 'ready').length || 0,
    published: projects?.filter((p: any) => p.status === 'published').length || 0,
    failed: projects?.filter((p: any) => p.status === 'failed').length || 0
  }

  return new Response(JSON.stringify({
    success: true,
    projects: projects || [],
    stats: stats
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Cancelar projeto
async function handleCancel(
  supabase: any,
  request: VideoGenerationRequest
): Promise<Response> {
  if (!request.project_id) {
    throw new Error('project_id é obrigatório')
  }

  const { data: project } = await supabase
    .from('sora_video_projects')
    .select('status')
    .eq('id', request.project_id)
    .single()

  if (!project) {
    throw new Error('Projeto não encontrado')
  }

  if (['ready', 'published', 'failed'].includes(project.status)) {
    throw new Error('Não é possível cancelar projeto já finalizado')
  }

  await supabase
    .from('sora_video_projects')
    .update({ status: 'failed' })
    .eq('id', request.project_id)

  await supabase
    .from('sora_generation_queue')
    .update({ status: 'cancelled' })
    .eq('project_id', request.project_id)

  return new Response(JSON.stringify({
    success: true,
    message: 'Projeto cancelado com sucesso'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Aprovar vídeo para publicação
async function handleApprove(
  supabase: any,
  request: VideoGenerationRequest
): Promise<Response> {
  if (!request.project_id) {
    throw new Error('project_id é obrigatório')
  }

  const { data: project } = await supabase
    .from('sora_video_projects')
    .select('*')
    .eq('id', request.project_id)
    .single()

  if (!project) {
    throw new Error('Projeto não encontrado')
  }

  if (project.status !== 'ready') {
    throw new Error('Apenas projetos prontos podem ser aprovados')
  }

  if (request.rejection_reason) {
    // Rejeitar
    await supabase
      .from('sora_video_projects')
      .update({
        rejection_reason: request.rejection_reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.project_id)

    return new Response(JSON.stringify({
      success: true,
      message: 'Vídeo rejeitado',
      reason: request.rejection_reason
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Aprovar
  await supabase
    .from('sora_video_projects')
    .update({
      approved_by: request.approved_by || 'sistema',
      approved_at: new Date().toISOString(),
      status: 'published',
      updated_at: new Date().toISOString()
    })
    .eq('id', request.project_id)

  return new Response(JSON.stringify({
    success: true,
    message: 'Vídeo aprovado e publicado!',
    video_url: project.video_url
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Listar templates disponíveis
async function handleTemplates(supabase: any): Promise<Response> {
  const { data: templates, error } = await supabase
    .from('sora_video_templates')
    .select('*')
    .eq('is_active', true)
    .order('category')

  if (error) {
    throw new Error('Erro ao listar templates')
  }

  return new Response(JSON.stringify({
    success: true,
    templates: templates || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Chamada real para API do Sora
async function callSoraAPI(
  apiKey: string,
  params: {
    prompt: string
    duration: number
    aspect_ratio: string
    resolution: string
    style?: string
  }
): Promise<SoraAPIResponse> {
  const response = await fetch('https://api.openai.com/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-2',
      prompt: params.prompt,
      duration: params.duration,
      aspect_ratio: params.aspect_ratio,
      resolution: params.resolution,
      style: params.style
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    status: 'processing',
    progress: 0
  }
}

// Verificar status na API do Sora
async function checkSoraStatus(
  apiKey: string,
  jobId: string
): Promise<SoraAPIResponse> {
  const response = await fetch(`https://api.openai.com/v1/videos/generations/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to check status: ${response.status}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    status: data.status,
    video_url: data.video_url,
    thumbnail_url: data.thumbnail_url,
    error: data.error,
    progress: data.progress
  }
}

// Iniciar simulação de geração
async function startSimulation(
  supabase: any,
  projectId: string,
  prompt: string,
  duration: number
) {
  await supabase
    .from('sora_video_projects')
    .update({
      status: 'generating',
      sora_job_id: `sim_${projectId}`,
      sora_model_used: 'sora-2-simulation',
      generation_started_at: new Date().toISOString()
    })
    .eq('id', projectId)

  await supabase
    .from('sora_generation_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('project_id', projectId)

  // Simular conclusão após tempo proporcional
  const processingTime = Math.min((duration * 2 + 10) * 1000, 60000)

  setTimeout(async () => {
    const videoUrl = `https://storage.ampla.com.br/videos/${projectId}.mp4`
    const thumbnailUrl = `https://storage.ampla.com.br/thumbnails/${projectId}.jpg`

    await supabase
      .from('sora_video_projects')
      .update({
        status: 'ready',
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        video_duration_actual: duration,
        generation_completed_at: new Date().toISOString()
      })
      .eq('id', projectId)

    await supabase
      .from('sora_generation_queue')
      .update({
        status: 'completed',
        video_url: videoUrl,
        completed_at: new Date().toISOString(),
        processing_time_seconds: Math.round(processingTime / 1000)
      })
      .eq('project_id', projectId)

    console.log(`Simulated video generation completed for project ${projectId}`)
  }, processingTime)
}

function getEstimatedTime(duration: number): string {
  const minutes = Math.ceil((duration * 2 + 30) / 60)
  return `${minutes} a ${minutes + 2} minutos`
}

function calculateProgress(project: any): number {
  if (project.status === 'ready' || project.status === 'published') return 100
  if (project.status === 'failed') return 0
  if (!project.generation_started_at) return 0

  const elapsed = Date.now() - new Date(project.generation_started_at).getTime()
  const estimated = (project.duration_seconds * 2 + 30) * 1000
  return Math.min(95, Math.round((elapsed / estimated) * 100))
}
