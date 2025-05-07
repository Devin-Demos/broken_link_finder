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
from typing import List, Dict, Optional, Any
import re

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

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

def extract_links(url: str, html_content: str) -> List[str]:
    """Extract all links from the HTML content."""
    soup = BeautifulSoup(html_content, 'html.parser')
    base_url = url
    
    base_tag = soup.find('base')
    if base_tag and base_tag.get('href'):
        base_url = base_tag['href']
    
    links = []
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if href.startswith('#'):
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
    
    unique_links = []
    for link in links:
        if link not in unique_links:
            unique_links.append(link)
    
    return unique_links

async def check_link(session: aiohttp.ClientSession, link: str) -> LinkResult:
    """Check if a link is broken."""
    try:
        async with session.get(link, timeout=10, allow_redirects=True) as response:
            return LinkResult(
                url=link,
                status=response.status,
                error=None,
                is_broken=response.status >= 400
            )
    except asyncio.TimeoutError:
        return LinkResult(
            url=link,
            status=None,
            error="Timeout",
            is_broken=True
        )
    except aiohttp.ClientError as e:
        return LinkResult(
            url=link,
            status=None,
            error=str(e),
            is_broken=True
        )
    except Exception as e:
        return LinkResult(
            url=link,
            status=None,
            error=f"Unexpected error: {str(e)}",
            is_broken=True
        )

@app.post("/check-links")
async def check_links(url_request: UrlRequest):
    """Check all links on a webpage."""
    url = str(url_request.url)
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        links = extract_links(url, response.text)
        
        if not links:
            return {"message": "No links found on the page", "results": []}
        
        async with aiohttp.ClientSession() as session:
            tasks = [check_link(session, link) for link in links]
            results = await asyncio.gather(*tasks)
        
        return {
            "message": f"Found {len(results)} links on the page",
            "results": [result.dict() for result in results]
        }
        
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")

@app.post("/export-csv")
async def export_csv(url_request: UrlRequest):
    """Export link check results as CSV."""
    url = str(url_request.url)
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        links = extract_links(url, response.text)
        
        if not links:
            raise HTTPException(status_code=404, detail="No links found on the page")
        
        async with aiohttp.ClientSession() as session:
            tasks = [check_link(session, link) for link in links]
            results = await asyncio.gather(*tasks)
        
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
