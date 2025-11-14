import { useState } from 'react'
import { Bot, Brain, TrendingDown, DollarSign, Shield, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface AIAgentPanelProps {
  clientId?: string
  transactionId?: string
}

interface AgentResult {
  success: boolean
  data?: any
  error?: string
}

type AgentType = 'chatbot' | 'churn' | 'pricing' | 'fraud'

const AGENTS = [
  {
    type: 'chatbot' as AgentType,
    name: 'AI Chatbot',
    description: 'Ask questions about invoices and payments',
    icon: MessageSquare,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  {
    type: 'churn' as AgentType,
    name: 'Churn Predictor',
    description: 'Predict client cancellation risk',
    icon: TrendingDown,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10'
  },
  {
    type: 'pricing' as AgentType,
    name: 'Pricing Optimizer',
    description: 'Optimize client fees based on complexity',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10'
  },
  {
    type: 'fraud' as AgentType,
    name: 'Fraud Detector',
    description: 'Detect suspicious transactions',
    icon: Shield,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10'
  }
]

export function AIAgentPanel({ clientId, transactionId }: AIAgentPanelProps) {
  const [executing, setExecuting] = useState<AgentType | null>(null)
  const [results, setResults] = useState<Record<AgentType, AgentResult | null>>({
    chatbot: null,
    churn: null,
    pricing: null,
    fraud: null
  })
  const [chatMessage, setChatMessage] = useState('')
  const { toast } = useToast()

  const executeAgent = async (agentType: AgentType) => {
    setExecuting(agentType)

    try {
      let functionName = ''
      let requestBody: any = {}

      switch (agentType) {
        case 'chatbot':
          if (!chatMessage) {
            throw new Error('Please enter a message')
          }
          functionName = 'ai-chatbot'
          requestBody = {
            client_id: clientId,
            message: chatMessage
          }
          break

        case 'churn':
          if (!clientId) {
            throw new Error('Client ID required')
          }
          functionName = 'ai-churn-predictor'
          requestBody = { client_id: clientId }
          break

        case 'pricing':
          if (!clientId) {
            throw new Error('Client ID required')
          }
          functionName = 'ai-pricing-optimizer'
          requestBody = { client_id: clientId }
          break

        case 'fraud':
          if (!transactionId) {
            throw new Error('Transaction ID required')
          }
          functionName = 'ai-fraud-detector'
          requestBody = {
            transaction_id: transactionId,
            client_id: clientId
          }
          break
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      })

      if (error) throw error

      if (data.success) {
        setResults(prev => ({
          ...prev,
          [agentType]: { success: true, data: data }
        }))

        toast({
          title: `${AGENTS.find(a => a.type === agentType)?.name} completed`,
          description: 'Analysis ready'
        })
      } else {
        throw new Error(data.error || 'Agent execution failed')
      }

    } catch (error: any) {
      console.error('Agent error:', error)

      setResults(prev => ({
        ...prev,
        [agentType]: { success: false, error: error.message }
      }))

      toast({
        title: 'Agent failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setExecuting(null)
      if (agentType === 'chatbot') {
        setChatMessage('')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {AGENTS.map(agent => {
          const Icon = agent.icon
          const isExecuting = executing === agent.type
          const result = results[agent.type]

          // Check if agent can be executed
          const canExecute = agent.type === 'fraud'
            ? !!transactionId
            : agent.type === 'chatbot'
            ? true
            : !!clientId

          return (
            <Card key={agent.type} className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 ${agent.bgColor} rounded`}>
                  <Icon className={`h-5 w-5 ${agent.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.description}
                  </p>
                </div>
              </div>

              {!canExecute ? (
                <Alert variant="default" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {agent.type === 'fraud'
                      ? 'Select a transaction first'
                      : 'Select a client first'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => executeAgent(agent.type)}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Execute
                    </>
                  )}
                </Button>
              )}

              {result && (
                <div className="mt-3 text-xs">
                  {result.success ? (
                    <div className="text-green-600">✓ Completed</div>
                  ) : (
                    <div className="text-red-600">✗ {result.error}</div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Results Section */}
      {Object.values(results).some(r => r?.success) && (
        <Tabs defaultValue="churn" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chatbot" disabled={!results.chatbot?.success}>
              Chatbot
            </TabsTrigger>
            <TabsTrigger value="churn" disabled={!results.churn?.success}>
              Churn
            </TabsTrigger>
            <TabsTrigger value="pricing" disabled={!results.pricing?.success}>
              Pricing
            </TabsTrigger>
            <TabsTrigger value="fraud" disabled={!results.fraud?.success}>
              Fraud
            </TabsTrigger>
          </TabsList>

          {/* Chatbot Results */}
          {results.chatbot?.success && (
            <TabsContent value="chatbot">
              <Card className="p-6">
                <h3 className="font-medium mb-4">Chatbot Response</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{results.chatbot.data.message}</p>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Churn Results */}
          {results.churn?.success && (
            <TabsContent value="churn">
              <Card className="p-6">
                <h3 className="font-medium mb-4">Churn Analysis</h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Churn Risk Score</span>
                      <span className="text-2xl font-bold text-red-500">
                        {results.churn.data.prediction?.churn_risk_score || 0}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${results.churn.data.prediction?.churn_risk_score || 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Risk Level</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      results.churn.data.prediction?.risk_level === 'critical'
                        ? 'bg-red-500/10 text-red-600'
                        : results.churn.data.prediction?.risk_level === 'high'
                        ? 'bg-orange-500/10 text-orange-600'
                        : results.churn.data.prediction?.risk_level === 'medium'
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-green-500/10 text-green-600'
                    }`}>
                      {results.churn.data.prediction?.risk_level?.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Main Reasons</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {results.churn.data.prediction?.main_reasons?.map((reason: string, i: number) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {results.churn.data.prediction?.recommendations?.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Pricing Results */}
          {results.pricing?.success && (
            <TabsContent value="pricing">
              <Card className="p-6">
                <h3 className="font-medium mb-4">Pricing Optimization</h3>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Current Fee</span>
                      <p className="text-xl font-bold">
                        R$ {results.pricing.data.current_fee?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Suggested Fee</span>
                      <p className="text-xl font-bold text-green-600">
                        R$ {results.pricing.data.optimization?.suggested_fee?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Positioning</span>
                      <p className="text-sm font-medium capitalize">
                        {results.pricing.data.optimization?.price_positioning}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Justification</h4>
                    <p className="text-sm text-muted-foreground">
                      {results.pricing.data.optimization?.justification}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Upsell Opportunities</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {results.pricing.data.optimization?.upsell_opportunities?.map((opp: string, i: number) => (
                        <li key={i}>{opp}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Fraud Results */}
          {results.fraud?.success && (
            <TabsContent value="fraud">
              <Card className="p-6">
                <h3 className="font-medium mb-4">Fraud Analysis</h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Fraud Score</span>
                      <span className="text-2xl font-bold text-yellow-500">
                        {results.fraud.data.fraud_analysis?.fraud_score || 0}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${results.fraud.data.fraud_analysis?.fraud_score || 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Recommendation</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      results.fraud.data.fraud_analysis?.recommendation === 'block'
                        ? 'bg-red-500/10 text-red-600'
                        : results.fraud.data.fraud_analysis?.recommendation === 'review'
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-green-500/10 text-green-600'
                    }`}>
                      {results.fraud.data.fraud_analysis?.recommendation?.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Red Flags</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                      {results.fraud.data.fraud_analysis?.red_flags?.map((flag: string, i: number) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Reasoning</h4>
                    <p className="text-sm text-muted-foreground">
                      {results.fraud.data.fraud_analysis?.reasoning}
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}
