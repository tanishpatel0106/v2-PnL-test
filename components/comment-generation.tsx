"use client"

import { useEffect, useState } from "react"
import { useAuth } from "./auth-provider"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Brain,
  Edit3,
  MessageCircle,
  CheckCircle,
  RefreshCw,
  Copy,
  FileDown,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import {
  generateComment,
  fetchComment,
  regenerateComment,
  approveComment,
} from "@/lib/api"

interface CommentGenerationProps {
  accountId: string
  periods: string[]
  companyCode: string
  siteCode: string
  accountData: any
  companyInfo?: string
  onFollowUp: () => void
  onContextChange?: (ctx: {
    accountJson: any
    summary: string
    finalComment: string
    companyInfo?: string
  } | null) => void
}

export function CommentGeneration({
  accountId,
  periods,
  companyCode,
  siteCode,
  accountData,
  companyInfo,
  onFollowUp,
  onContextChange,
}: CommentGenerationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [editableComment, setEditableComment] = useState("")
  const [finalComment, setFinalComment] = useState("")
  const [summary, setSummary] = useState("")
  const { user } = useAuth()

  const fetchStoredComment = async () => {
    if (!accountData) return
    setIsLoading(true)
    setIsApproved(false)
    try {
      const stored = await fetchComment({
        accountId,
        companyCode,
        siteCode,
        periods,
      })
      if (stored) {
        const summaryText = stored.summary || ""
        const detailed = stored.final_comment || summaryText
        setSummary(summaryText)
        setFinalComment(detailed)
        setEditableComment(summaryText)
        onContextChange?.({
          accountJson: accountData,
          summary: summaryText,
          finalComment: detailed,
          companyInfo,
        })
        setIsApproved(!!stored.approved_comment)
      }
    } catch {
      setSummary("Failed to load comment")
    } finally {
      setIsLoading(false)
    }
  }

  const generateNew = async () => {
    if (!accountData) return
    setIsLoading(true)
    setIsApproved(false)
    try {
      const res = await generateComment({
        accountId,
        companyCode,
        siteCode,
        periods,
        accountJson: accountData,
        companyInfo,
      })
      setSummary(res.summary)
      setFinalComment(res.final_comment)
      setEditableComment(res.summary)
      onContextChange?.({
        accountJson: accountData,
        summary: res.summary,
        finalComment: res.final_comment,
        companyInfo,
      })
    } catch {
      setSummary("Failed to generate comment")
      setFinalComment("")
      setEditableComment("")
    } finally {
      setIsLoading(false)
    }
  }

  const regenerate = async () => {
    if (!accountData) return
    setIsLoading(true)
    setIsApproved(false)
    try {
      const res = await regenerateComment({
        accountId,
        companyCode,
        siteCode,
        periods,
        accountJson: accountData,
        companyInfo,
      })
      setSummary(res.summary)
      setFinalComment(res.final_comment)
      setEditableComment(res.summary)
      onContextChange?.({
        accountJson: accountData,
        summary: res.summary,
        finalComment: res.final_comment,
        companyInfo,
      })
    } catch {
      setSummary("Failed to generate comment")
      setFinalComment("")
      setEditableComment("")
    } finally {
      setIsLoading(false)
    }
  }

  // Clear previous comments when account data changes
  useEffect(() => {
    setSummary("")
    setFinalComment("")
    setEditableComment("")
    setIsApproved(false)
    onContextChange?.(null)
  }, [accountData])
  // Fetch existing comment when account data changes
  useEffect(() => {
    if (accountData) {
      fetchStoredComment()
    }
  }, [accountData, companyInfo])

  const handleGenerate = () => {
    if (summary) {
      regenerate()
    } else {
      generateNew()
    }
  }

  const handleApprove = () => {
    approveComment({
      accountId,
      companyCode,
      siteCode,
      periods,
      comment: editableComment,
      user: user || 'AI.Admin'
    })
      .then(() => {
        setIsApproved(true)
        toast.success("Comment Approved! ✅")
      })
      .catch(() => toast.error("Failed to approve comment"))
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editableComment)
    toast.success("Comment copied to clipboard!")
  }

  return (
    <div className="space-y-6">
      {/* AI Generated Comment */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />🧠 AI-Generated Comment
            {finalComment && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <Info className="w-4 h-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Detailed Comment</DialogTitle>
                  </DialogHeader>
                  <p className="whitespace-pre-wrap text-sm">{finalComment}</p>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Textarea
              value={summary}
              readOnly
              className="min-h-24 bg-white/50 border-purple-200 resize-none"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable Comment */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            ✍️ Editable Comment
            {isApproved && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Approved
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={editableComment}
            onChange={(e) => {
              if (isApproved) setIsApproved(false)
              setEditableComment(e.target.value)
            }}
            className="min-h-32 bg-white border-blue-200"
            placeholder="Edit your comment here..."
          />

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              variant="outline"
              className="hover:bg-purple-50 border-purple-200"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {summary ? "Regenerate" : "Generate"}
            </Button>

            <Button onClick={onFollowUp} variant="outline" className="hover:bg-blue-50 border-blue-200">
              <MessageCircle className="w-4 h-4 mr-2" />
              FollowUp
            </Button>

            <Button
              onClick={handleApprove}
              disabled={isApproved}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isApproved ? "Approved" : "Approve"}
            </Button>

            <div className="flex gap-2 ml-auto">
              <Button onClick={handleCopy} variant="ghost" size="sm" className="text-gray-600 hover:text-gray-800">
                <Copy className="w-4 h-4" />
              </Button>

              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-800">
                <FileDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
