"use client"

interface PowerBIEmbedProps {
  embedUrl: string
  height?: number | string
}

export function PowerBIEmbed({ embedUrl, height = 600 }: PowerBIEmbedProps) {
  return (
    <div className="w-full" style={{ height }}>
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allowFullScreen
      />
    </div>
  )
}
