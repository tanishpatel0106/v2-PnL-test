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
import { Input } from "@/components/ui/input"
import { MessageCircle, CheckCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  fetchMonthlyComment,
  updateMonthlyComment,
  approveMonthlyComment,
  monthlyFollowUpMessage,
  monthlyRegenerateRequest,
} from "@/lib/api"
import { FollowUpChat } from "./followup-chat"

interface MonthlyCommentEditorProps {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

export function MonthlyCommentEditor({ companyCode, siteCode, year, period }: MonthlyCommentEditorProps) {
  const { user } = useAuth()
  const [generated, setGenerated] = useState("")
  const [editableComment, setEditableComment] = useState("")
  const [isApproved, setIsApproved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatContext, setChatContext] = useState<{ summary: string; finalComment: string; accountJson: any } | null>(null)
  const [regenOpen, setRegenOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [reason, setReason] = useState("")
  const [regenLoading, setRegenLoading] = useState(false)

  useEffect(() => {
    if (user && user.includes('@') && !email) {
      setEmail(user)
    }
  }, [user])

  useEffect(() => {
    if (!companyCode || !siteCode || !year || !period) return
    setLoading(true)
    setGenerated("")
    setEditableComment("")
    setIsApproved(false)
    fetchMonthlyComment({ companyCode, siteCode, year, period })
      .then((res) => {
        if (res && res.monthly_summary) {
          setGenerated(res.monthly_summary)
          setEditableComment(res.approved_summary || res.monthly_summary)
          setIsApproved(!!res.approved_summary)
          setChatContext({ summary: res.monthly_summary, finalComment: res.approved_summary || "", accountJson: {} })
        } else {
          setGenerated("")
          setEditableComment("")
          toast.error("Comment has not been generated yet, contact AI Support to get your summary generated.")
        }
      })
      .catch(() => {
        setGenerated("Failed to load comment")
      })
      .finally(() => setLoading(false))
  }, [companyCode, siteCode, year, period])

  const handleSave = () => {
    updateMonthlyComment({ companyCode, siteCode, year, period, monthlySummary: editableComment })
      .then(() => toast.success("Comment saved"))
      .catch(() => toast.error("Failed to save comment"))
  }

  const handleApprove = () => {
    approveMonthlyComment({ companyCode, siteCode, year, period, summary: editableComment, user: user || "AI.Admin" })
      .then(() => {
        setIsApproved(true)
        toast.success("Comment Approved! ✅")
      })
      .catch(() => toast.error("Failed to approve comment"))
  }

  const handleRegenerateRequest = () => {
    setRegenLoading(true)
    monthlyRegenerateRequest({ companyCode, siteCode, year, period, email, reason })
      .then(() => {
        toast.success("Request successfully generated, AI team will contact you.")
        setRegenOpen(false)
        setEmail("")
        setReason("")
      })
      .catch(() => toast.error("Failed to submit request"))
      .finally(() => setRegenLoading(false))   // ← release the lock
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📝 Monthly Comment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Textarea value={generated} readOnly className="min-h-40 bg-white/50 border-purple-200 resize-none" />
            {loading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ✏️ Editable Comment
            {isApproved && (
              <Badge className="bg-green-100 text-green-800 border-green-200 ml-2">
                <CheckCircle className="w-3 h-3 mr-1" /> Approved
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
            className="min-h-48 bg-white border-blue-200"
            placeholder="Edit your comment here..."
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} variant="outline" className="hover:bg-gray-50 border-gray-200">
              Save
            </Button>
            <Button onClick={() => setChatOpen(true)} variant="outline" className="hover:bg-blue-50 border-blue-200">
              <MessageCircle className="w-4 h-4 mr-2" /> FollowUp
            </Button>
            <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="hover:bg-purple-50 border-purple-200">
                  Regenerate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input readOnly value={companyCode} className="flex-1" />
                    <Input readOnly value={siteCode} className="flex-1" />
                  </div>
                  <Input placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Textarea placeholder="Reason for regeneration" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" />
                  <Button
                    className="w-full flex items-center justify-center"
                    onClick={handleRegenerateRequest}
                    disabled={regenLoading || !email || !reason}
                  >
                    {regenLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={handleApprove} disabled={isApproved} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" /> {isApproved ? "Approved" : "Approve"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FollowUpChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={chatContext}
        sendMessage={monthlyFollowUpMessage}
      />
    </div>
  )
}
