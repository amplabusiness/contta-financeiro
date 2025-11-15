import { useState } from 'react'
import { CreditCard, QrCode, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import QRCode from 'qrcode'

interface CoraChargeManagerProps {
  invoice: any
}

interface ChargeResult {
  charge_id: string
  boleto_url?: string
  pix_qrcode?: string
  pix_copy_paste?: string
  payment_link?: string
}

export function CoraChargeManager({ invoice }: CoraChargeManagerProps) {
  const [creating, setCreating] = useState(false)
  const [charge, setCharge] = useState<ChargeResult | null>(null)
  const [showPixDialog, setShowPixDialog] = useState(false)
  const [qrCodeImage, setQrCodeImage] = useState<string>('')
  const { toast } = useToast()

  const handleCreateCharge = async () => {
    setCreating(true)

    try {
      const { data, error } = await supabase.functions.invoke('cora-banking-service', {
        body: {
          action: 'create_charge',
          data: {
            invoice_id: invoice.id
          }
        }
      })

      if (error) throw error

      if (data.success) {
        setCharge(data.data)

        // Generate QR Code image if PIX available
        if (data.data.pix_copy_paste) {
          const qrImage = await QRCode.toDataURL(data.data.pix_copy_paste)
          setQrCodeImage(qrImage)
        }

        toast({
          title: 'Charge created successfully!',
          description: 'Boleto and PIX are now available'
        })
      } else {
        throw new Error(data.error || 'Failed to create charge')
      }

    } catch (error: any) {
      console.error('Cora charge error:', error)

      toast({
        title: 'Failed to create charge',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: 'PIX code copied to clipboard'
    })
  }

  const existingCharge = invoice.external_charge_id && {
    charge_id: invoice.external_charge_id,
    boleto_url: invoice.boleto_url,
    pix_qrcode: invoice.pix_qrcode,
    pix_copy_paste: invoice.pix_copy_paste,
    payment_link: invoice.payment_link
  }

  const displayCharge = charge || existingCharge

  return (
    <div className="space-y-4">
      {!displayCharge ? (
        <Card className="p-6">
          <div className="text-center">
            <h3 className="font-medium mb-2">Generate Payment Methods</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create boleto and PIX for this invoice
            </p>

            <Button
              onClick={handleCreateCharge}
              disabled={creating}
              className="w-full sm:w-auto"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Generate Charge
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Boleto Card */}
          {displayCharge.boleto_url && (
            <Card className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Boleto Bancário</h3>
                  <p className="text-sm text-muted-foreground">
                    Traditional bank slip
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(displayCharge.boleto_url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Boleto
              </Button>
            </Card>
          )}

          {/* PIX Card */}
          {displayCharge.pix_copy_paste && (
            <Card className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-green-500/10 rounded">
                  <QrCode className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium">PIX</h3>
                  <p className="text-sm text-muted-foreground">
                    Instant payment
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPixDialog(true)}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Show QR Code
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(displayCharge.pix_copy_paste!)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy PIX Code
                </Button>
              </div>
            </Card>
          )}

          {/* Payment Link */}
          {displayCharge.payment_link && (
            <Card className="p-6 md:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium mb-1">Payment Page</h3>
                  <p className="text-sm text-muted-foreground">
                    Send this link to your client
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => window.open(displayCharge.payment_link, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Page
                </Button>
              </div>

              <div className="mt-4 p-3 bg-muted rounded text-sm font-mono break-all">
                {displayCharge.payment_link}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* PIX QR Code Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PIX QR Code</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {qrCodeImage || displayCharge?.pix_qrcode ? (
              <div className="flex justify-center p-4 bg-white rounded">
                <img
                  src={qrCodeImage || `data:image/png;base64,${displayCharge?.pix_qrcode}`}
                  alt="PIX QR Code"
                  className="w-64 h-64"
                />
              </div>
            ) : null}

            <div>
              <p className="text-sm font-medium mb-2">PIX Copy & Paste:</p>
              <div className="p-3 bg-muted rounded text-xs font-mono break-all">
                {displayCharge?.pix_copy_paste}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => copyToClipboard(displayCharge?.pix_copy_paste || '')}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
