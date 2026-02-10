import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'
import { DeleteIdeaButton } from '@/components/delete-idea-button'
import { GenerateJobsButton } from '@/components/generate-jobs-button'
import { GenerateAndExportButton } from '@/components/generate-and-export-button'
import { getIdeaWithDetails, getPostInstances } from '@/lib/db'
import { PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'

// Disable caching - force fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function IdeaDetailPage({
  params,
}: {
  params: { id: string }
}) {
  let ideaWithDetails
  let error = null

  try {
    ideaWithDetails = await getIdeaWithDetails(params.id)
  } catch (err: any) {
    error = err.message
    console.error('Error fetching idea:', err)
  }

  if (error || !ideaWithDetails) {
    notFound()
  }

  const { personas, ...idea } = ideaWithDetails
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const slideBucket = process.env.NEXT_PUBLIC_SLIDE_ASSETS_BUCKET || 'slide-assets'
  
  // Get post instances count for this idea
  const postInstances = await getPostInstances({ ideaId: params.id })
  const completePosts = postInstances.filter((p) => p.status === 'complete').length

  const resolveImageUrl = (path?: string, metadata?: Record<string, any>) => {
    if (!path) return null
    if (metadata?.publicUrl) return metadata.publicUrl as string
    if (!supabaseUrl) return null
    return `${supabaseUrl}/storage/v1/object/public/${slideBucket}/${path}`
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/ideas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ideas
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/ideas/${idea.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Idea
            </Button>
          </Link>
          <GenerateAndExportButton ideaId={idea.id} ideaTitle={idea.title} />
          <DeleteIdeaButton ideaId={idea.id} ideaTitle={idea.title} />
        </div>
      </div>

      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{idea.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="px-2 py-1 bg-primary/10 rounded text-primary">
              {idea.category}
            </span>
            <span>Created {new Date(idea.created_at).toLocaleDateString()}</span>
          </div>
          {idea.description && (
            <p className="mt-4 text-muted-foreground">{idea.description}</p>
          )}
        </div>

        {/* Post Instances Status */}
        {postInstances.length > 0 && (
          <div className="mb-6 border border-border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Generated Posts</h3>
              <Link href={`/posts?idea=${idea.id}`}>
                <Button variant="ghost" size="sm">
                  View all →
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {(['uk', 'us', 'ksa', 'my'] as const).map((country) => {
                const countryPosts = postInstances.filter((p) => p.country === country)
                const complete = countryPosts.filter((p) => p.status === 'complete').length
                return (
                  <div key={country} className="text-center">
                    <p className="text-sm font-medium">{COUNTRY_LABELS[country]}</p>
                    <p className="text-2xl font-bold text-primary">{complete}</p>
                    <p className="text-xs text-muted-foreground">of {countryPosts.length} ready</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {personas.map((persona) => (
            <div key={persona.id} className="border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                {(PERSONA_LABELS as Record<string, string>)[persona.persona_type] ?? persona.persona_type} Persona
              </h2>

              {persona.countries.length === 0 ? (
                <p className="text-muted-foreground">No countries configured</p>
              ) : (
                <div className="space-y-6">
                  {persona.countries.map((country: (typeof persona.countries)[number]) => (
                    <div key={country.id} className="border-l-2 border-primary pl-4">
                      <h3 className="font-medium mb-3">
                        {(COUNTRY_LABELS as Record<string, string>)[country.country] ?? country.country}
                        {country.status === 'ready' && (
                          <span className="ml-2 text-xs px-2 py-1 bg-green-500/20 text-green-600 rounded">
                            Ready
                          </span>
                        )}
                      </h3>

                      {country.slides.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No slides yet</p>
                      ) : (
                        <div className="space-y-3">
                          {country.slides.map((slide: (typeof country.slides)[number]) => (
                            <div key={slide.id} className="bg-muted/50 rounded p-3 space-y-3">
                              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                <span>
                                  Slide {slide.slide_number}: {slide.slide_type}
                                </span>
                                {slide.title && (
                                  <span className="text-foreground font-normal">{slide.title}</span>
                                )}
                              </div>

                              {slide.text_variants && slide.text_variants.length > 0 ? (
                                <div className="space-y-2">
                                  {slide.text_variants.map((variant: (typeof slide.text_variants)[number]) => (
                                    <div key={variant.id} className="rounded border border-border bg-background/80 p-2">
                                      <div className="text-xs font-semibold text-primary">
                                        {variant.variant_label}
                                      </div>
                                      <div className="text-sm whitespace-pre-wrap">
                                        {variant.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : slide.content ? (
                                <div className="text-sm">{slide.content}</div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No text variants provided.
                                </p>
                              )}

                              {slide.image_variants && slide.image_variants.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                    Image Variants
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {slide.image_variants.map((image: (typeof slide.image_variants)[number]) => {
                                      const imageUrl = resolveImageUrl(image.storage_path, image.metadata)
                                      return (
                                        <div key={image.id} className="border border-border rounded-md p-2 space-y-1">
                                          <div className="text-sm font-medium">{image.variant_label}</div>
                                          {image.caption && (
                                            <div className="text-xs text-muted-foreground">{image.caption}</div>
                                          )}
                                          {image.aspect_ratio && (
                                            <div className="text-xs text-muted-foreground">
                                              Aspect: {image.aspect_ratio}
                                            </div>
                                          )}
                                          {imageUrl ? (
                                            <a
                                              href={imageUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-xs text-primary underline"
                                            >
                                              View Image
                                            </a>
                                          ) : (
                                            <div className="text-xs text-muted-foreground">
                                              {image.storage_path}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

