const apiUrlFromEnv = (import.meta.env.PUBLIC_API_URL || import.meta.env.VITE_PUBLIC_API_URL || '').trim()
const publicTestData = (import.meta.env.PUBLIC_TEST_DATA || import.meta.env.VITE_PUBLIC_TEST_DATA || '').trim()

export const API_URL = apiUrlFromEnv || 'https://quicksync-api.ktz.me'

export const DATA_URL =
  publicTestData === 'true'
    ? '/test-data.json'
    : 'https://pub-c66d7559b64a430ca682a4bd624f04d8.r2.dev/benchmarks.json'

