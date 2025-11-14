import { useState, useEffect } from 'react'
import { Landmark, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface PluggyConnectProps {
  clientId?: string
  onConnected?: () => void
}

interface BankAccount {
  id: string
  bank_name: string
  account_number?: string
  balance: number
  last_sync_at?: string
  sync_enabled: boolean
}

export function PluggyConnect({ clientId, onConnected }: PluggyConnectProps) {
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (clientId) {
      loadAccounts()
    }
  }, [clientId])

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)

      if (error) throw error

      setAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)

    try {
      // Get connect token from Pluggy
      const { data, error } = await supabase.functions.invoke('pluggy-integration', {
        body: {
          action: 'create_connect_token'
        }
      })

      if (error) throw error

      if (data.success) {
        const connectToken = data.data.accessToken

        // Open Pluggy Connect Widget
        openPluggyWidget(connectToken)
      } else {
        throw new Error(data.error || 'Failed to create connect token')
      }

    } catch (error: any) {
      console.error('Pluggy connect error:', error)

      toast({
        title: 'Connection failed',
        description: error.message,
        variant: 'destructive'
      })

      setConnecting(false)
    }
  }

  const openPluggyWidget = (connectToken: string) => {
    // This would open the Pluggy Connect Widget
    // In a real implementation, you'd use the Pluggy SDK:
    // https://docs.pluggy.ai/docs/pluggy-connect

    /* Example:
    const pluggyConnect = new PluggyConnect({
      connectToken,
      onSuccess: (itemData) => {
        handlePluggySuccess(itemData)
      },
      onError: (error) => {
        toast({ title: 'Connection failed', description: error.message, variant: 'destructive' })
        setConnecting(false)
      }
    })

    pluggyConnect.open()
    */

    // For now, show a message
    toast({
      title: 'Pluggy Widget',
      description: 'Pluggy Connect Widget would open here. Implement Pluggy SDK for production.'
    })

    setConnecting(false)
  }

  const handlePluggySuccess = async (itemData: any) => {
    try {
      // Save bank account to database
      const { error } = await supabase
        .from('bank_accounts')
        .insert({
          client_id: clientId,
          bank_name: itemData.connector.name,
          pluggy_item_id: itemData.id,
          is_active: true,
          sync_enabled: true
        })

      if (error) throw error

      toast({
        title: 'Bank connected!',
        description: 'Account connected successfully'
      })

      loadAccounts()
      onConnected?.()
    } catch (error: any) {
      toast({
        title: 'Failed to save account',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async (accountId: string) => {
    setSyncing(true)

    try {
      const account = accounts.find(a => a.id === accountId)

      if (!account) throw new Error('Account not found')

      const { data, error } = await supabase.functions.invoke('pluggy-integration', {
        body: {
          action: 'sync_transactions',
          data: {
            item_id: account.pluggy_item_id,
            account_id: account.pluggy_account_id
          }
        }
      })

      if (error) throw error

      if (data.success) {
        toast({
          title: 'Sync completed',
          description: `${data.data.imported} transactions imported`
        })

        loadAccounts()
      } else {
        throw new Error(data.error || 'Sync failed')
      }

    } catch (error: any) {
      console.error('Sync error:', error)

      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)

    try {
      const { data, error } = await supabase.functions.invoke('pluggy-integration', {
        body: {
          action: 'sync_all_accounts'
        }
      })

      if (error) throw error

      if (data.success) {
        const successful = data.data.results.filter((r: any) => r.status === 'success').length

        toast({
          title: 'Sync completed',
          description: `${successful} accounts synced successfully`
        })

        loadAccounts()
      } else {
        throw new Error(data.error || 'Sync failed')
      }

    } catch (error: any) {
      console.error('Sync all error:', error)

      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Landmark className="h-6 w-6 text-primary" />
            </div>

            <h3 className="font-medium mb-2">Connect Bank Account</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your bank account via Open Finance to automatically import transactions
            </p>

            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Landmark className="mr-2 h-4 w-4" />
                  Connect Bank
                </>
              )}
            </Button>

            <Alert className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This feature uses Open Finance (Pluggy) to securely connect to your bank account.
                Your banking credentials are never stored.
              </AlertDescription>
            </Alert>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Connected Accounts</h3>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncAll}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync All
                  </>
                )}
              </Button>

              <Button size="sm" onClick={handleConnect} disabled={connecting}>
                <Landmark className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map(account => (
              <Card key={account.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded">
                      <Landmark className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{account.bank_name}</h4>
                      {account.account_number && (
                        <p className="text-xs text-muted-foreground">
                          {account.account_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {account.sync_enabled && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Balance</span>
                    <p className="font-medium">
                      R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(account.id)}
                    disabled={syncing}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>

                {account.last_sync_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last sync: {new Date(account.last_sync_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
