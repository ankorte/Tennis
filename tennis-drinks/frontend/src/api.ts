import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Toast-Callback – wird von App gesetzt
let _showToast: ((msg: string, type?: 'error' | 'success' | 'info') => void) | null = null
export function setApiToast(fn: typeof _showToast) { _showToast = fn }

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (err.response?.status === 429) {
      _showToast?.('Zu viele Anfragen – bitte kurz warten', 'error')
    } else if (err.response?.status >= 500) {
      _showToast?.('Serverfehler – bitte später erneut versuchen', 'error')
    }
    return Promise.reject(err)
  }
)

export default api
