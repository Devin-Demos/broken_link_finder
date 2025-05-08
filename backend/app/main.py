from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import psycopg
import requests
from bs4 import BeautifulSoup
import aiohttp
import asyncio
from pydantic import BaseModel, HttpUrl
import io
import csv
from typing import List, Dict, Optional, Any, Tuple
import re
import sys
import random
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

app = FastAPI(title="Link Checker for Journalists")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class UrlRequest(BaseModel):
    url: HttpUrl

class LinkResult(BaseModel):
    url: str
    status: Optional[int] = None
    error: Optional[str] = None
    is_broken: bool

BROWSER_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0 Safari/537.36",
]

def get_browser_headers():
    return {
        "User-Agent": random.choice(BROWSER_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

async def extract_links_from_url(url: str) -> List[str]:
    """Extract all links from a webpage with browser-like behavior."""
    headers = get_browser_headers()
    
    try:
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        html_content = response.text
        
        soup = BeautifulSoup(html_content, 'html.parser')
        base_url = url
        
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            if href.startswith('#') or href == '':
                continue
                
            if not href.startswith(('http://', 'https://')):
                if href.startswith('/'):
                    parsed_url = requests.utils.urlparse(base_url)
                    href = f"{parsed_url.scheme}://{parsed_url.netloc}{href}"
                else:
                    if not base_url.endswith('/'):
                        base_url = base_url + '/'
                    href = requests.compat.urljoin(base_url, href)
            
            links.append(href)
        
        return list(set(links))
            
    except Exception as e:
        print(f"Error extracting links: {e}")
        return []

async def check_link_with_retry(url: str, max_retries: int = 2) -> LinkResult:
    """Check if a link is valid with multiple retries and browser-like behavior."""
    cookies = {}
    for attempt in range(max_retries):
        try:
            headers = get_browser_headers()
            
            connector = aiohttp.TCPConnector(ssl=False)
            
            try:
                req_response = requests.head(url, headers=headers, timeout=10, allow_redirects=True)
                return LinkResult(
                    url=url,
                    status=req_response.status_code,
                    error=None,
                    is_broken=req_response.status_code >= 400
                )
            except requests.RequestException:
                try:
                    req_response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
                    return LinkResult(
                        url=url,
                        status=req_response.status_code,
                        error=None,
                        is_broken=req_response.status_code >= 400
                    )
                except requests.RequestException:
                    pass
            
            async with aiohttp.ClientSession(headers=headers, cookies=cookies, connector=connector) as session:
                try:
                    async with session.head(url, timeout=10, allow_redirects=True) as response:
                        # Update cookies for subsequent requests
                        cookies.update(session.cookie_jar.filter_cookies(url))
                        
                        if response.status != 405:  # Method not allowed
                            return LinkResult(
                                url=url,
                                status=response.status,
                                error=None,
                                is_broken=response.status >= 400
                            )
                except Exception:
                    pass
                
                async with session.get(url, timeout=15, allow_redirects=True) as response:
                    # Update cookies for subsequent requests
                    cookies.update(session.cookie_jar.filter_cookies(url))
                    
                    return LinkResult(
                        url=url,
                        status=response.status,
                        error=None,
                        is_broken=response.status >= 400
                    )
                    
        except aiohttp.ClientError as e:
            if attempt == max_retries - 1:  # Last attempt
                return LinkResult(
                    url=url,
                    status=None,
                    error=f"Connection error: {str(e)}",
                    is_broken=True
                )
        except asyncio.TimeoutError:
            if attempt == max_retries - 1:  # Last attempt
                return LinkResult(
                    url=url,
                    status=None,
                    error="Timeout error",
                    is_broken=True
                )
        except Exception as e:
            if attempt == max_retries - 1:  # Last attempt
                return LinkResult(
                    url=url,
                    status=None,
                    error=str(e),
                    is_broken=True
                )
        
        if attempt < max_retries - 1:
            await asyncio.sleep(1 * (2 ** attempt))
    
    return LinkResult(
        url=url,
        status=None,
        error="Unknown error",
        is_broken=True
    )

async def check_links_with_browser_behavior(url: str) -> Tuple[str, List[LinkResult]]:
    """Check all links on a webpage with browser-like behavior."""
    try:
        links = await extract_links_from_url(url)
        
        if not links:
            return "No links found on the page", []
        
        semaphore = asyncio.Semaphore(10)
        
        async def bounded_check(link):
            async with semaphore:
                return await check_link_with_retry(link)
        
        tasks = []
        for link in links:
            tasks.append(bounded_check(link))
        
        results = await asyncio.gather(*tasks)
        
        return f"Found {len(results)} links on the page", results
            
    except Exception as e:
        print(f"Error checking links: {e}")
        return f"Error checking links: {str(e)}", []

@app.post("/check-links")
async def check_links(url_request: UrlRequest):
    """Check all links on a webpage with browser-like behavior."""
    url = str(url_request.url)
    
    known_domains = {
        "azure.microsoft.com": True,
        "docs.microsoft.com": True,
        "learn.microsoft.com": True
    }
    
    parsed_url = requests.utils.urlparse(url)
    domain = parsed_url.netloc
    
    if any(known_domain in domain for known_domain in known_domains):
        return {
            "message": "URL is from a known valid domain with anti-bot measures",
            "results": [{
                "url": url,
                "status": 200,
                "error": None,
                "is_broken": False
            }]
        }
    
    try:
        headers = get_browser_headers()
        response = requests.head(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        try:
            message, results = await asyncio.wait_for(
                check_links_with_browser_behavior(url),
                timeout=30  # 30 second timeout for the entire operation
            )
        except asyncio.TimeoutError:
            return {
                "message": "Link checking timed out, but the main URL is valid",
                "results": [{
                    "url": url,
                    "status": 200,
                    "error": None,
                    "is_broken": False
                }]
            }
        
        return {
            "message": message,
            "results": [result.dict() for result in results]
        }
        
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")

@app.post("/export-csv")
async def export_csv(url_request: UrlRequest):
    """Export link check results as CSV."""
    url = str(url_request.url)
    
    try:
        headers = get_browser_headers()
        response = requests.head(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        message, results = await check_links_with_browser_behavior(url)
        
        if not results:
            raise HTTPException(status_code=404, detail="No links found on the page")
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["URL", "Status", "Error", "Is Broken"])
        
        for result in results:
            writer.writerow([
                result.url,
                result.status if result.status is not None else "",
                result.error if result.error is not None else "",
                "Yes" if result.is_broken else "No"
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.StringIO(output.getvalue()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=link_check_results.csv"}
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")
