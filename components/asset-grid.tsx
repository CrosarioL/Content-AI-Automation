'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Eye, ExternalLink, Play, X, CheckSquare, Square, Share2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'
import type { Persona, Country } from '@/types'

interface Asset {
  id: string
  ideaId: string
  ideaTitle: string
  persona: Persona
  country: Country
  outputUrl: string
  createdAt: string
  updatedAt: string
}

interface AssetGridProps {
  assets: Asset[]
}

export function AssetGrid({ assets }: AssetGridProps) {
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [postingStatus, setPostingStatus] = useState<{
    platform: string
    status: 'idle' | 'posting' | 'success' | 'error'
    message?: string
  }>({ platform: '', status: 'idle' })

  const toggleSelect = (id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedAssets(new Set(assets.map((a) => a.id)))
  }

  const deselectAll = () => {
    setSelectedAssets(new Set())
  }

  const downloadAsset = async (asset: Asset) => {
    if (!asset.outputUrl) return
    
    try {
      const response = await fetch(asset.outputUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${asset.ideaTitle}-${asset.persona}-${asset.country}.mp4`.replace(/\s+/g, '-')
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      // Fallback: open in new tab
      window.open(asset.outputUrl, '_blank')
    }
  }

  const downloadSelected = async () => {
    const toDownload = assets.filter((a) => selectedAssets.has(a.id))
    for (const asset of toDownload) {
      await downloadAsset(asset)
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const postToSocial = async (asset: Asset, platform: 'tiktok' | 'instagram') => {
    if (!asset.outputUrl) return
    
    setPostingStatus({ platform, status: 'posting' })
    
    try {
      const response = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          videoUrl: asset.outputUrl,
          caption: `${asset.ideaTitle} #${asset.persona} #${asset.country}`,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setPostingStatus({
          platform,
          status: 'success',
          message: `Posted to ${platform}!`,
        })
      } else {
        setPostingStatus({
          platform,
          status: 'error',
          message: data.error || `Failed to post to ${platform}`,
        })
      }
    } catch (err: any) {
      setPostingStatus({
        platform,
        status: 'error',
        message: err.message || `Failed to post to ${platform}`,
      })
    }
  }

  const isVideo = (url: string) => {
    return url.toLowerCase().endsWith('.mp4') || url.includes('video')
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedAssets.size > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedAssets.size} selected
              </span>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
          )}
        </div>
        {selectedAssets.size > 0 && (
          <Button variant="default" size="sm" onClick={downloadSelected}>
            <Download className="mr-1.5 h-4 w-4" />
            Download Selected ({selectedAssets.size})
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className={`relative rounded-lg border overflow-hidden transition-all ${
              selectedAssets.has(asset.id)
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {/* Thumbnail / Preview */}
            <div
              className="aspect-[9/16] bg-muted relative cursor-pointer group"
              onClick={() => setPreviewAsset(asset)}
            >
              {asset.outputUrl ? (
                isVideo(asset.outputUrl) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
                    <Play className="h-12 w-12 text-white/80" />
                    <video
                      src={asset.outputUrl}
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ) : (
                  <img
                    src={asset.outputUrl}
                    alt={`${asset.ideaTitle} - ${asset.persona} - ${asset.country}`}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  No preview
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewAsset(asset)
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadAsset(asset)
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              {/* Selection checkbox */}
              <button
                type="button"
                className="absolute top-2 left-2 p-1 rounded bg-black/50 hover:bg-black/70 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelect(asset.id)
                }}
              >
                {selectedAssets.has(asset.id) ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-white/70" />
                )}
              </button>
            </div>

            {/* Info */}
            <div className="p-3 space-y-1">
              <Link
                href={`/ideas/${asset.ideaId}`}
                className="font-medium text-sm hover:text-primary truncate block"
              >
                {asset.ideaTitle}
              </Link>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {PERSONA_LABELS[asset.persona]} • {COUNTRY_LABELS[asset.country]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(asset.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative max-w-md w-full bg-background rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setPreviewAsset(null)}
            >
              <X className="h-5 w-5" />
            </button>

            {previewAsset.outputUrl && (
              <div className="aspect-[9/16] bg-black">
                {isVideo(previewAsset.outputUrl) ? (
                  <video
                    src={previewAsset.outputUrl}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={previewAsset.outputUrl}
                    alt={previewAsset.ideaTitle}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}

            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{previewAsset.ideaTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {PERSONA_LABELS[previewAsset.persona]} • {COUNTRY_LABELS[previewAsset.country]}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadAsset(previewAsset)}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </Button>
                {previewAsset.outputUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewAsset.outputUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Social Posting */}
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  Post to Social Media
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => postToSocial(previewAsset, 'tiktok')}
                    disabled={postingStatus.status === 'posting'}
                  >
                    {postingStatus.platform === 'tiktok' && postingStatus.status === 'posting' 
                      ? 'Posting...' 
                      : 'TikTok'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => postToSocial(previewAsset, 'instagram')}
                    disabled={postingStatus.status === 'posting'}
                  >
                    {postingStatus.platform === 'instagram' && postingStatus.status === 'posting' 
                      ? 'Posting...' 
                      : 'Instagram'}
                  </Button>
                </div>
                {postingStatus.status !== 'idle' && (
                  <p className={`text-xs mt-2 flex items-center gap-1 ${
                    postingStatus.status === 'success' ? 'text-emerald-600' : 
                    postingStatus.status === 'error' ? 'text-rose-600' : 
                    'text-muted-foreground'
                  }`}>
                    {postingStatus.status === 'error' && <AlertCircle className="h-3 w-3" />}
                    {postingStatus.message}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Note: API posting requires platform developer approval. 
                  For now, download and upload manually.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

