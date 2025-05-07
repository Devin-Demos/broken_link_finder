import { useState } from 'react'
import axios from 'axios'
import './App.css'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table'
import { Alert, AlertDescription } from './components/ui/alert'
import { Loader2, Download, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface LinkResult {
  url: string
  status: number | null
  error: string | null
  is_broken: boolean
}

interface CheckLinksResponse {
  message: string
  results: LinkResult[]
}

function App() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<LinkResult[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url) {
      setError('Please enter a URL')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults([])
    setMessage(null)

    try {
      const response = await axios.post<CheckLinksResponse>(`${API_URL}/check-links`, { url })
      setResults(response.data.results)
      setMessage(response.data.message)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.detail || 'An error occurred while checking links')
      } else {
        setError('An error occurred while checking links')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadCSV = async () => {
    if (!url) return

    try {
      const response = await axios.post(`${API_URL}/export-csv`, { url }, {
        responseType: 'blob'
      })
      
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', 'link_check_results.csv')
      document.body.appendChild(link)
      link.click()
      
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.detail || 'An error occurred while downloading CSV')
      } else {
        setError('An error occurred while downloading CSV')
      }
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Link Checker for Journalists</CardTitle>
          <CardDescription>
            Check for broken links on a webpage and export the results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="url"
                placeholder="Enter webpage URL (e.g., https://example.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} className="whitespace-nowrap">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Links...
                </>
              ) : (
                'Check Links'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{message}</h2>
            <Button onClick={handleDownloadCSV} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-full">URL</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {result.is_broken ? (
                            <div className="flex items-center text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Broken
                            </div>
                          ) : (
                            <div className="flex items-center text-green-500">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Valid
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm truncate max-w-md">
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center hover:underline"
                          >
                            {result.url}
                            <ExternalLink className="h-3 w-3 ml-1 inline flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>
                          {result.status ? (
                            <span className={result.is_broken ? 'text-red-500' : 'text-green-500'}>
                              {result.status}
                            </span>
                          ) : (
                            <span className="text-red-500">{result.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default App
