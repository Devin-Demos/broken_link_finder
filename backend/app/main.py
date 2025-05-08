from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import psycopg
import requests
from pydantic import BaseModel, HttpUrl
import io
import csv
from typing import List, Dict, Optional, Any
import re
import sys
import subprocess
import json
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

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

async def run_broken_link_checker(url: str) -> List[LinkResult]:
    """Use requests and BeautifulSoup to check links on a webpage as a fallback when Node.js is not available."""
    try:
        try:
            temp_file = Path(__file__).parent.parent / "link_results.json"
            
            cmd = [
                "node", 
                "-e", 
                f"""
                const blc = require('broken-link-checker');
                const fs = require('fs');
                
                const results = [];
                
                const options = {{
                    excludeExternalLinks: false,
                    excludeInternalLinks: false,
                    excludeLinksToSamePage: true,
                    honorRobotExclusions: true,
                    filterLevel: 0,
                    maxSocketsPerHost: 5,
                    requestMethod: "GET",
                    userAgent: "Mozilla/5.0 (compatible; BrokenLinkChecker/0.1)"
                }};
                
                const siteChecker = new blc.SiteChecker(options, {{
                    link: function(result, customData) {{
                        const linkInfo = {{
                            url: result.url.resolved,
                            status: result.http.response ? result.http.response.statusCode : null,
                            error: result.broken ? (result.brokenReason || "Unknown error") : null,
                            is_broken: result.broken
                        }};
                        results.push(linkInfo);
                    }},
                    end: function() {{
                        fs.writeFileSync('{temp_file}', JSON.stringify(results));
                        process.exit(0);
                    }}
                }});
                
                siteChecker.enqueue('{url}');
                """
            ]
            
            process = subprocess.run(cmd, check=True, timeout=10)
            
            if temp_file.exists():
                with open(temp_file, 'r') as f:
                    results_data = json.load(f)
                
                link_results = [
                    LinkResult(
                        url=item['url'],
                        status=item['status'],
                        error=item['error'],
                        is_broken=item['is_broken']
                    )
                    for item in results_data
                ]
                
                temp_file.unlink()
                
                return link_results
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
            print(f"Node.js broken-link-checker not available, using fallback: {e}")
        
        from bs4 import BeautifulSoup
        import asyncio
        import aiohttp
        
        response = requests.get(url, timeout=10)
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
        
        links = list(set(links))
        
        async def check_link(link):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.head(link, timeout=10, allow_redirects=True) as response:
                        return LinkResult(
                            url=link,
                            status=response.status,
                            error=None,
                            is_broken=response.status >= 400
                        )
            except Exception as e:
                return LinkResult(
                    url=link,
                    status=None,
                    error=str(e),
                    is_broken=True
                )
        
        tasks = [check_link(link) for link in links]
        results = await asyncio.gather(*tasks)
        
        return results
            
    except Exception as e:
        print(f"Error checking links: {e}")
        return []

@app.post("/check-links")
async def check_links(url_request: UrlRequest):
    """Check all links on a webpage using broken-link-checker."""
    url = str(url_request.url)
    
    try:
        response = requests.head(url, timeout=10)
        response.raise_for_status()
        
        results = await run_broken_link_checker(url)
        
        if not results:
            return {"message": "No links found on the page", "results": []}
        
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
        response = requests.head(url, timeout=10)
        response.raise_for_status()
        
        results = await run_broken_link_checker(url)
        
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
