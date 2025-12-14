type ViteEnv = Partial<{
  PROD: boolean
  PUBLIC_API_URL: string
  VITE_PUBLIC_API_URL: string
  USE_PRODUCTION_DATA: string
  VITE_USE_PRODUCTION_DATA: string
}>

const env = ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) satisfies ViteEnv

const apiUrlFromEnv = (env.PUBLIC_API_URL || env.VITE_PUBLIC_API_URL || '').trim()
const useProductionDataRaw = (env.USE_PRODUCTION_DATA || env.VITE_USE_PRODUCTION_DATA || '').trim()

export const API_URL = apiUrlFromEnv || 'https://quicksync-api.ktz.me'

const useProductionDataOverride =
  useProductionDataRaw === 'true' ? true : useProductionDataRaw === 'false' ? false : null

// Always use the production dataset for production builds.
const isProductionBuild = env.PROD === true

// In dev, default to local `public/test-data.json`; opt into production data explicitly.
const useProductionData = isProductionBuild ? true : (useProductionDataOverride ?? false)

export const DATA_URL =
  useProductionData ? 'https://pub-c66d7559b64a430ca682a4bd624f04d8.r2.dev/benchmarks.json' : '/test-data.json'
