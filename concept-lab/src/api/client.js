const baseUrl = ''

export async function apiClient(path, options = {}) {
  const { headers, ...requestOptions } = options
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`)
  }

  return response.status === 204 ? null : response.json()
}
