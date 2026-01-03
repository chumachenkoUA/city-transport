import axios from 'axios'

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.message as string | undefined) || error.message
  }
  return fallback
}
