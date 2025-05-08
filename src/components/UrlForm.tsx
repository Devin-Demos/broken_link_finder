
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface UrlFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const UrlForm: React.FC<UrlFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple URL validation
    let processedUrl = url.trim();
    
    if (!processedUrl) {
      toast.error("Please enter a URL");
      return;
    }

    // Add https:// if not present
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = "https://" + processedUrl;
    }

    try {
      // Check if URL is valid
      new URL(processedUrl);
      onSubmit(processedUrl);
    } catch (error) {
      toast.error("Please enter a valid URL");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
          Enter a webpage URL
        </label>
        <div className="flex gap-2">
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com/article"
            className="flex-grow"
            disabled={isLoading}
            aria-describedby="url-description"
          />
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="whitespace-nowrap"
          >
            {isLoading ? "Checking..." : "Check Links"}
          </Button>
        </div>
        <p id="url-description" className="mt-2 text-sm text-gray-500">
          We'll check all links on this single page (no crawling).
        </p>
      </div>
    </form>
  );
};

export default UrlForm;
