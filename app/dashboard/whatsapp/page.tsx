'use client'

import { useState, useEffect, useRef } from 'react'
import { useOrgStore } from '@/lib/store'
import { localDb, type WhatsappSimMessage } from '@/lib/localDb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Send,
  Check,
  CheckCheck,
  Sparkles,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Mic,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

export default function WhatsappSimulator() {
  const { currentOrg } = useOrgStore()
  const [messages, setMessages] = useState<WhatsappSimMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [activeChat, setActiveChat] = useState<'copilot' | 'apex' | 'a1'>('copilot')
  const [isTyping, setIsTyping] = useState(false)
  const [isVoiceSimulating, setIsVoiceSimulating] = useState(false)
  const [voiceQueryIndex, setVoiceQueryIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load message logs from localDb
  const loadMessages = () => {
    if (!currentOrg) return
    const logs = localDb.getWhatsappMessages(currentOrg.id)
    if (logs.length === 0) {
      // Seed default messages if empty
      const defaultLogs: WhatsappSimMessage[] = [
        {
          id: 'welcome',
          orgId: currentOrg.id,
          sender: 'bot',
          text: '👋 *Welcome to Retail Copilot WhatsApp Assistant!*\n\nI am your AI retail business operations manager. I will monitor inventory, predict stockouts, suggest discount pricing, and alert you of opportunities.\n\n_Type "help" to see what queries I can solve._',
          type: 'alert',
          status: 'read',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ]
      localDb.saveWhatsappMessages(currentOrg.id, defaultLogs)
      setMessages(defaultLogs)
    } else {
      setMessages(logs)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [currentOrg])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSendMessage = (textToSend = inputText) => {
    if (!textToSend.trim() || !currentOrg) return

    const userMsg: WhatsappSimMessage = {
      id: `msg_user_${Date.now()}`,
      orgId: currentOrg.id,
      sender: 'user',
      text: textToSend,
      type: 'text',
      status: 'delivered',
      timestamp: new Date().toISOString(),
    }

    const updated = [...messages, userMsg]
    setMessages(updated)
    localDb.saveWhatsappMessages(currentOrg.id, updated)
    setInputText('')

    // Simulate AI response typing
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      const botResponse = generateAiResponse(textToSend.toLowerCase())
      
      const botMsg: WhatsappSimMessage = {
        id: `msg_bot_${Date.now()}`,
        orgId: currentOrg.id,
        sender: 'bot',
        text: botResponse.text,
        type: botResponse.type || 'text',
        status: 'read',
        approvalData: botResponse.approvalData,
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...updated, botMsg]
      setMessages(finalMessages)
      localDb.saveWhatsappMessages(currentOrg.id, finalMessages)
    }, 1200)
  }

  // Voice command simulation uploader
  const handleVoiceSimulate = () => {
    if (isVoiceSimulating) return
    setIsVoiceSimulating(true)
    
    const queries = [
      'What are my top low stock items?',
      'Check gross margin and profits reports.',
      'Show my dead stock items and stagnant capital.',
      'simulate alert'
    ]
    
    const sampleQuery = queries[voiceQueryIndex]
    setVoiceQueryIndex((prev) => (prev + 1) % queries.length)
    
    let currentIdx = 0
    setInputText('')

    const interval = setInterval(() => {
      setInputText((prev) => prev + sampleQuery[currentIdx])
      currentIdx++
      if (currentIdx >= sampleQuery.length) {
        clearInterval(interval)
        setTimeout(() => {
          setIsVoiceSimulating(false)
          handleSendMessage(sampleQuery)
        }, 600)
      }
    }, 45)
  }

  // Live database updates triggered by WhatsApp approvals!
  const handleApproveAction = (msgId: string, approvalData: any) => {
    if (!currentOrg) return

    try {
      const items = localDb.getItems(currentOrg.id)
      const targetItem = items.find((i) => i.id === approvalData.itemId)
      if (!targetItem) {
        toast.error('Item not found in inventory catalog')
        return
      }

      let logMessage = ''

      if (approvalData.actionType === 'discount') {
        const newPrice = approvalData.details.newPrice
        // Apply price adjustment directly to database
        localDb.updateItem(targetItem.id, {
          sellingPrice: newPrice,
        })
        logMessage = `✅ *Markdown Approved!* We have marked down *${targetItem.name}* to *${formatCurrency(newPrice)}* in your store inventory catalog.`
        toast.success(`Active markdown set for ${targetItem.name}`)
      } else if (approvalData.actionType === 'reorder') {
        const qty = approvalData.details.quantity
        const newQty = targetItem.quantity + qty
        
        // Update stock levels
        localDb.updateItem(targetItem.id, {
          quantity: newQty,
        })

        // Log purchase order transaction
        localDb.addTransaction({
          orgId: currentOrg.id,
          itemId: targetItem.id,
          type: 'purchase',
          quantity: qty,
          unitPrice: targetItem.costPrice,
          totalAmount: qty * targetItem.costPrice,
          notes: `WhatsApp automated purchase order approval`,
          createdBy: 'whatsapp_bot',
        })
        logMessage = `✅ *Reorder Approved!* Order for *${qty} units* of *${targetItem.name}* was dispatched to *${targetItem.supplier || 'A-1 Wholesalers'}*. Stock increased to *${newQty} units*.`
        toast.success(`Purchase order dispatched for ${targetItem.name}`)
      }

      // Update message status in view & localDb log
      const updatedMessages = messages.map((msg) => {
        if (msg.id === msgId) {
          return {
            ...msg,
            text: `${msg.text}\n\n*STATUS:* Approved 🟩`,
            approvalData: undefined, // remove actions since committed
          }
        }
        return msg
      })

      // Send bot confirmation message
      const botConfirmation: WhatsappSimMessage = {
        id: `confirm_${Date.now()}`,
        orgId: currentOrg.id,
        sender: 'bot',
        text: logMessage,
        type: 'text',
        status: 'read',
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...updatedMessages, botConfirmation]
      setMessages(finalMessages)
      localDb.saveWhatsappMessages(currentOrg.id, finalMessages)
    } catch (e) {
      console.error(e)
      toast.error('Failed to execute WhatsApp action')
    }
  }

  const handleRejectAction = (msgId: string) => {
    if (!currentOrg) return

    const updatedMessages = messages.map((msg) => {
      if (msg.id === msgId) {
        return {
          ...msg,
          text: `${msg.text}\n\n*STATUS:* Rejected 🟥`,
          approvalData: undefined,
        }
      }
      return msg
    })

    const botConfirmation: WhatsappSimMessage = {
      id: `confirm_${Date.now()}`,
      orgId: currentOrg.id,
      sender: 'bot',
      text: `❌ *Proposal Rejected.* No adjustments were committed.`,
      type: 'text',
      status: 'read',
      timestamp: new Date().toISOString(),
    }

    const finalMessages = [...updatedMessages, botConfirmation]
    setMessages(finalMessages)
    localDb.saveWhatsappMessages(currentOrg.id, finalMessages)
    toast.info('Proposal rejected')
  }

  // Dialog flow responses matching business vocabulary
  const generateAiResponse = (input: string): { text: string; type?: 'text' | 'alert' | 'approval'; approvalData?: any } => {
    if (!currentOrg) return { text: 'Store context loading...' }
    
    const items = localDb.getItems(currentOrg.id)
    const transactions = localDb.getTransactions(currentOrg.id)

    if (input.includes('help')) {
      return {
        text: `💡 *RETAIL COPILOT UTILITY PANEL*\n\nTry sending the following questions to get real-time store intel:\n\n1. *"margins"* - Audits markup compression & gross profit margins.\n2. *"stock"* - Returns low stock SKUs needing reordering.\n3. *"dead stock"* - Lists slow moving inventory tying up capital.\n4. *"simulate"* - Triggers a new interactive approval flow alert!`,
      }
    }

    if (input.includes('margin') || input.includes('profit') || input.includes('sales')) {
      const sales = transactions.filter(t => t.type === 'sale')
      const totalRev = sales.reduce((sum, t) => sum + t.totalAmount, 0)
      const totalCost = sales.reduce((sum, t) => {
        const item = items.find(i => i.id === t.itemId)
        return sum + (item?.costPrice || 0) * t.quantity
      }, 0)
      const margin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0
      
      return {
        text: `📈 *STORE MARGIN REPORT*\n\n• *Gross Revenues:* ${formatCurrency(totalRev)}\n• *Gross Profits:* ${formatCurrency(totalRev - totalCost)}\n• *Average Margins:* *${margin.toFixed(1)}%*\n\nYour top profit engine category is *Food & Beverages*. Keep prices stable!`,
      }
    }

    if (input.includes('stock') || input.includes('low stock') || input.includes('reorder')) {
      const low = items.filter(i => i.quantity <= i.minStockLevel)
      if (low.length === 0) {
        return { text: `✅ All product SKUs are well above safety reorder thresholds. Excellent inventory health!` }
      }
      return {
        text: `🚨 *LOW STOCK LEDGER*\n\nHere are products currently running low:\n\n${low.map(i => `• *${i.name}* - Qty: *${i.quantity} left* (Safety: ${i.minStockLevel})`).join('\n')}\n\nType *"simulate"* to generate an order dispatch card!`,
      }
    }

    if (input.includes('dead') || input.includes('stagnant') || input.includes('slow')) {
      const dead = items.filter(i => i.id === 'item_6' || i.id === 'item_7')
      return {
        text: `📦 *STAGNANT STOCK REPORT*\n\nWe found *${dead.length} items* with zero sales velocity in the last 45+ days:\n\n${dead.map(i => `• *${i.name}* - Qty: ${i.quantity} units, Cost Value: ${formatCurrency(i.quantity * i.costPrice)}`).join('\n')}\n\nCapital is locked. Suggesting a 15% markdown clearout campaign. Type *"simulate"* to approve clearance markdown!`,
      }
    }

    if (input.includes('simulate') || input.includes('alert')) {
      // Simulate low stock approval alert
      const lowItem = items.find(i => i.quantity <= i.minStockLevel) || items[0]
      return {
        text: `🚨 *AI DECISION GATEWAY*\n\n*${lowItem.name}* is critically low at *${lowItem.quantity} units*.\n\nWe recommend reordering *20 units* from *${lowItem.supplier || 'A-1 Wholesalers'}*.\n\n*Procurement Cost:* ${formatCurrency(lowItem.costPrice * 20)}\n*Est. Restock Arrival:* 2 days.\n\nApprove this restock purchase ledger entry?`,
        type: 'approval',
        approvalData: {
          actionType: 'reorder',
          itemId: lowItem.id,
          details: { quantity: 20, cost: lowItem.costPrice }
        }
      }
    }

    return {
      text: `🤖 *Retail Assistant:* I received your request: "${input}".\n\nI can execute complex inventory lookups, discount calculations, or purchase approvals. Type *help* to see core commands!`,
    }
  }

  return (
    <div className="h-[calc(100vh-140px)] min-h-[500px] flex rounded-2xl border bg-card overflow-hidden shadow-xl">
      {/* Chats Sidebar */}
      <div className="w-80 border-r flex flex-col bg-muted/10 shrink-0">
        {/* Search */}
        <div className="p-4 border-b bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search or start new chat" className="pl-9 bg-muted/40" />
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-2 space-y-1">
            <div
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                activeChat === 'copilot' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40'
              }`}
              onClick={() => setActiveChat('copilot')}
            >
              <Avatar className="h-11 w-11 border-2 border-primary/20 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary">
                  <Sparkles className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1">
                    AI Retail Copilot
                    <Badge className="bg-green-500 hover:bg-green-600 text-[8px] h-3 px-1 py-0 border-none rounded-full flex items-center gap-0.5 text-white">
                      Verified
                    </Badge>
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Online</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  {messages[messages.length - 1]?.text.replace(/\*|_/g, '') || 'Start chatting...'}
                </p>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                activeChat === 'apex' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40'
              }`}
              onClick={() => setActiveChat('apex')}
            >
              <Avatar className="h-11 w-11 border shrink-0">
                <AvatarFallback className="bg-muted-foreground/10 text-foreground">
                  AF
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-foreground">Apex FMCG Distributors</h4>
                  <span className="text-[10px] text-muted-foreground">Yesterday</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  Your purchase order #AF-4318 is dispatched.
                </p>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                activeChat === 'a1' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40'
              }`}
              onClick={() => setActiveChat('a1')}
            >
              <Avatar className="h-11 w-11 border shrink-0">
                <AvatarFallback className="bg-muted-foreground/10 text-foreground">
                  A1
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-foreground">A-1 Wholesalers</h4>
                  <span className="text-[10px] text-muted-foreground">2 days ago</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  Attached is Nestle May distribution catalog.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col bg-muted/5">
        {/* Chat Header */}
        <div className="h-16 px-6 border-b bg-card flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/15">
              <AvatarFallback className="bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-xs flex items-center gap-1.5">
                AI Retail Copilot
                <Badge className="bg-green-500 hover:bg-green-600 text-[8px] h-3 px-1.5 py-0 border-none rounded-full flex items-center text-white">
                  Verified Assistant
                </Badge>
              </h3>
              <p className="text-[10px] text-green-500 font-medium animate-pulse">Online assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <Phone className="h-4.5 w-4.5 cursor-pointer hover:text-foreground transition-colors" />
            <Video className="h-4.5 w-4.5 cursor-pointer hover:text-foreground transition-colors" />
            <MoreVertical className="h-4.5 w-4.5 cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/50 via-card to-card">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      isBot
                        ? 'bg-card border text-card-foreground rounded-tl-none'
                        : 'bg-primary text-primary-foreground rounded-tr-none'
                    }`}
                  >
                    {/* Message Body */}
                    <div className="text-[13px] leading-relaxed whitespace-pre-line font-normal">
                      {msg.text.split('\n').map((line: string, idx: number) => {
                        // Apply simulated bolding to double stars e.g. *bold*
                        let formatted = line
                        const boldRegex = /\*(.*?)\*/g
                        
                        let matches = line.match(boldRegex)
                        if (matches) {
                          matches.forEach((m: string) => {
                            const clean = m.replace(/\*/g, '')
                            formatted = formatted.replace(m, `<strong>${clean}</strong>`)
                          })
                        }

                        let item = <span key={idx} dangerouslySetInnerHTML={{ __html: formatted }} />
                        return (
                          <p key={idx} className="mt-0.5 first:mt-0">
                            {item}
                          </p>
                        )
                      })}
                    </div>

                    {/* Interactive Approval Card */}
                    {isBot && msg.approvalData && (
                      <div className="mt-3.5 border-t pt-3 flex flex-col gap-2 bg-muted/30 p-2.5 rounded-lg border">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                           <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                          Pending Catalog Approval
                        </div>
                        <div className="flex gap-2 mt-1.5">
                          <Button
                            size="sm"
                            className="flex-1 text-[11px] h-8 bg-green-600 hover:bg-green-700 text-white border-none"
                            onClick={() => handleApproveAction(msg.id, msg.approvalData)}
                          >
                            Approve Action
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-[11px] h-8"
                            onClick={() => handleRejectAction(msg.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Message Footer Info */}
                    <div
                      className={`text-[9px] flex items-center justify-end gap-1.5 mt-1.5 ${
                        isBot ? 'text-muted-foreground' : 'text-primary-foreground/75'
                      }`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isBot && (
                        <CheckCheck className="h-3 w-3 text-sky-300 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-card border text-card-foreground rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Copilot is writing</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45 animate-bounce"></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Control Box */}
        <div className="p-4 border-t bg-card flex items-center gap-3 shadow-sm shrink-0">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            placeholder={isVoiceSimulating ? 'Listening voice note...' : 'Type message here ("help" for tips)...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary h-11"
            disabled={isVoiceSimulating}
          />

          {inputText.trim() ? (
            <Button
              onClick={() => handleSendMessage()}
              size="icon"
              className="shrink-0 bg-primary hover:bg-primary/95 text-primary-foreground h-11 w-11 rounded-full shadow"
            >
              <Send className="h-5.5 w-5.5" />
            </Button>
          ) : (
            <Button
              onClick={handleVoiceSimulate}
              size="icon"
              variant="outline"
              className={`shrink-0 h-11 w-11 rounded-full shadow transition-all ${
                isVoiceSimulating ? 'bg-red-500 border-none text-white animate-pulse' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mic className={`h-5.5 w-5.5 ${isVoiceSimulating ? 'scale-110' : ''}`} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
