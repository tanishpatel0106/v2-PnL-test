"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Bot, User } from "lucide-react"

import { sendFollowUpMessage, ChatMessage, FollowUpChatRequest, FollowUpChatResponse } from "@/lib/api"

interface FollowUpChatProps {
  isOpen: boolean
  onClose: () => void
  context?: {
    summary: string
    finalComment: string
    accountJson: any
    companyInfo?: string
  } | null
  sendMessage?: (req: FollowUpChatRequest) => Promise<FollowUpChatResponse>
}

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
}

export function FollowUpChat({ isOpen, onClose, context, sendMessage }: FollowUpChatProps) {
  const [messages, setMessages] = useState<Message[]>([])

  const [newMessage, setNewMessage] = useState("")

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: "user",
      timestamp: new Date(),
    }
    const updated = [...messages, userMessage]
    setMessages(updated)
    setNewMessage("")

    try {
      const send = sendMessage || sendFollowUpMessage
      const res = await send({
        message: userMessage.content,
        history: updated.map((m) => ({ role: m.sender, content: m.content } as ChatMessage)),
        companyInfo: context?.companyInfo,
      })
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: res.reply,
        sender: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiResponse])
    } catch {
      // ignore errors for now
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setNewMessage("")
    } else if (context && messages.length === 0) {
      setMessages([
        {
          id: "0",
          content: context.summary,
          sender: "assistant",
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, context])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💬 FollowUp Chat
            <div className="flex items-center gap-1 text-sm text-green-600 font-normal">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              AI Assistant Online
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.sender === "assistant" && (
                  <Avatar className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500">
                    <AvatarFallback>
                      <Bot className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className={`max-w-[80%] ${message.sender === "user" ? "order-first" : ""}`}>
                  <div
                    className={`p-3 rounded-lg ${
                      message.sender === "user" ? "bg-blue-600 text-white ml-auto" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 px-1">{formatTime(message.timestamp)}</p>
                </div>

                {message.sender === "user" && (
                  <Avatar className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500">
                    <AvatarFallback>
                      <User className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
