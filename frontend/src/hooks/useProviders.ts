import { useEffect, useState } from 'react'
import { ensureAuth, getProviders, type ProviderCatalogEntry } from '../api'
import { PROVIDER_MODELS, PROVIDERS } from '../data/demo'

// Catálogo del backend (fuente de verdad). Fallback local si el backend no responde.
let cache: ProviderCatalogEntry[] | null = null
const listeners = new Set<(v: ProviderCatalogEntry[]) => void>()

function fallbackCatalog(): ProviderCatalogEntry[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.name,
    enabled: true,
    models: PROVIDER_MODELS[p.id] ?? [],
    note: '',
    default_model: (PROVIDER_MODELS[p.id] ?? [])[0] ?? null,
  }))
}

export async function refreshProviders(): Promise<ProviderCatalogEntry[]> {
  await ensureAuth()
  const list = await getProviders()
  cache = list.length ? list : fallbackCatalog()
  listeners.forEach((l) => l(cache!))
  return cache
}

/** Hook: devuelve el catálogo de proveedores/modelos del backend (con fallback). */
export function useProviders(): { catalog: ProviderCatalogEntry[]; reload: () => void } {
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>(cache ?? fallbackCatalog())

  useEffect(() => {
    const l = (v: ProviderCatalogEntry[]) => setCatalog(v)
    listeners.add(l)
    if (!cache) void refreshProviders()
    else setCatalog(cache)
    return () => {
      listeners.delete(l)
    }
  }, [])

  return { catalog, reload: () => void refreshProviders() }
}

/** Modelos permitidos para un proveedor, desde el catálogo del backend. */
export function modelsForProvider(catalog: ProviderCatalogEntry[], providerId: string): string[] {
  const entry = catalog.find((p) => p.id === providerId)
  if (entry && entry.models.length) return entry.models
  return PROVIDER_MODELS[providerId] ?? []
}

/** Modelo por defecto de un proveedor: respeta la preferencia del usuario
 *  (panel BYOK → sc_model_prefs) y si no, el primero del catálogo. */
export function defaultModelFor(catalog: ProviderCatalogEntry[], providerId: string): string {
  let prefs: Record<string, string> = {}
  try {
    prefs = JSON.parse(localStorage.getItem('sc_model_prefs') ?? '{}')
  } catch {
    /* noop */
  }
  const models = modelsForProvider(catalog, providerId)
  if (prefs[providerId] && models.includes(prefs[providerId])) return prefs[providerId]
  return models[0] ?? ''
}
