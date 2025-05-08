
import { LinkCheckResult } from "@/types/linkTypes";
import { toast } from "sonner";

export const checkLinks = async (url: string): Promise<LinkCheckResult[]> => {
  try {
    // Show initial loading toast
    toast.info("Fetching page content...", { id: "fetch-status" });
    
    // Try multiple CORS proxies in case one fails
    const corsProxies = [
      "https://api.allorigins.win/raw?url=",
      "https://corsproxy.io/?",
      "https://cors-anywhere.herokuapp.com/"
    ];
    
    let html = null;
    let proxyUsed = "";
    let error = null;
    
    // Try each proxy until one works
    for (const proxy of corsProxies) {
      try {
        const targetUrl = encodeURIComponent(url);
        const proxyUrl = `${proxy}${targetUrl}`;
        
        console.log(`Trying proxy: ${proxy}`);
        
        // Fetch the page content with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const pageResponse = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'User-Agent': 'Mozilla/5.0 (compatible; LinkScribe/1.0)'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!pageResponse.ok) {
          throw new Error(`Failed to fetch the page: ${pageResponse.status} ${pageResponse.statusText}`);
        }
        
        html = await pageResponse.text();
        proxyUsed = proxy;
        break; // Exit the loop if we successfully got the content
      } catch (err) {
        error = err;
        console.log(`Proxy ${proxy} failed:`, err);
        // Continue to next proxy
      }
    }
    
    if (!html) {
      // If all proxies failed, throw the last error
      throw error || new Error("All proxies failed to fetch the content");
    }
    
    toast.info("Extracting links...", { id: "fetch-status" });
    
    // Extract links using regex
    const links = extractLinks(html, url);
    
    // Deduplicate links
    const uniqueLinks = [...new Set(links)];
    
    // Limit to 25 links for demo purposes
    const limitedLinks = uniqueLinks.slice(0, 25);
    
    if (limitedLinks.length === 0) {
      toast.info("No links found on the page", { id: "fetch-status" });
      return [];
    }
    
    toast.success(`Found ${limitedLinks.length} links to check`, { id: "fetch-status" });
    
    // Check links (with throttling to avoid too many concurrent requests)
    const results = await checkLinksInBatches(limitedLinks, 3, proxyUsed);
    
    return results;
  } catch (error) {
    console.error("Error checking links:", error);
    toast.error(`Failed to check links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

// Extract links from HTML using regex
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  try {
    // Create a DOM parser to handle HTML correctly
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Get all anchor elements
    const anchorElements = doc.querySelectorAll('a');
    
    anchorElements.forEach(anchor => {
      try {
        const href = anchor.getAttribute('href');
        
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          try {
            // Handle both absolute and relative URLs
            const resolvedUrl = new URL(href, baseUrl).toString();
            links.push(resolvedUrl);
          } catch (e) {
            console.warn("Skipping invalid URL:", href);
          }
        }
      } catch (e) {
        console.error("Error processing link:", e);
      }
    });
  } catch (e) {
    // Fallback to regex if DOM parsing fails
    console.log("DOM parsing failed, falling back to regex");
    const hrefRegex = /href=["']((?:(?:https?|ftp):\/\/|\/)[^"'\s>]+)["']/gi;
    let match;
    
    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        
        if (href && !href.startsWith("javascript:") && !href.startsWith('#')) {
          try {
            const resolvedUrl = new URL(href, baseUrl).toString();
            links.push(resolvedUrl);
          } catch (e) {
            console.warn("Skipping invalid URL:", href);
          }
        }
      } catch (e) {
        console.error("Error processing link:", e);
      }
    }
  }

  return links;
}

// Process links in batches to avoid too many concurrent requests
async function checkLinksInBatches(links: string[], batchSize: number, proxyUsed: string): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];
  const totalLinks = links.length;
  
  toast.info(`Starting to check ${totalLinks} links...`, { id: "check-progress" });
  
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    const batchPromises = batch.map(link => checkSingleLink(link, proxyUsed));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Update toast with progress
    const progress = Math.min(100, Math.round(((i + batchSize) / links.length) * 100));
    toast.info(`Checking links: ${progress}% complete`, { id: "check-progress" });
  }
  
  const brokenCount = results.filter(r => !r.isWorking).length;
  toast.dismiss("check-progress");
  
  if (brokenCount > 0) {
    toast.warning(`Found ${brokenCount} broken link${brokenCount > 1 ? 's' : ''}`);
  } else {
    toast.success("All links are working properly!");
  }
  
  return results;
}

async function checkSingleLink(url: string, proxyUsed: string): Promise<LinkCheckResult> {
  try {
    // Add cache-busting parameter to avoid cached responses
    const urlWithCacheBuster = new URL(url);
    urlWithCacheBuster.searchParams.append('_cb', Date.now().toString());
    
    // For external URLs, use the same CORS proxy that worked for the initial page
    const targetUrl = encodeURIComponent(urlWithCacheBuster.toString());
    const proxyUrl = `${proxyUsed}${targetUrl}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      // Try a HEAD request first (faster)
      const response = await fetch(proxyUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkScribe/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      return {
        url,
        isWorking: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `${response.status} ${response.statusText}`,
      };
    } catch (headError) {
      console.log(`HEAD request failed for ${url}, trying GET`);
      
      // If HEAD fails, try GET instead (some servers don't support HEAD)
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 8000);
      
      try {
        const response = await fetch(proxyUrl, {
          method: "GET",
          redirect: "follow",
          signal: getController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LinkScribe/1.0)'
          }
        });
        
        clearTimeout(getTimeoutId);
        
        return {
          url,
          isWorking: response.ok,
          statusCode: response.status,
          error: response.ok ? undefined : `${response.status} ${response.statusText}`,
        };
      } catch (getError) {
        clearTimeout(getTimeoutId);
        throw getError;
      }
    }
  } catch (error) {
    let errorMessage = "Connection failed";
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timeout";
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      url,
      isWorking: false,
      error: errorMessage,
    };
  }
}
