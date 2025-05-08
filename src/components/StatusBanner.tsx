
import React from "react";
import { LinkCheckResult } from "@/types/linkTypes";
import { Card } from "@/components/ui/card";
import { Check, AlertCircle } from "lucide-react";

interface StatusBannerProps {
  results: LinkCheckResult[];
  url: string;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ results, url }) => {
  if (results.length === 0) {
    return (
      <Card className="p-4 bg-blue-50 border-blue-200 text-blue-700 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">No links found</p>
            <p className="text-sm">We didn't find any links on the page. Check the URL and try again.</p>
          </div>
        </div>
      </Card>
    );
  }

  const brokenLinks = results.filter(result => !result.isWorking);
  const brokenCount = brokenLinks.length;
  const totalCount = results.length;
  const allWorking = brokenCount === 0;

  return (
    <Card 
      className={`p-4 max-w-3xl mx-auto ${
        allWorking ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      <div className="flex items-center gap-3">
        {allWorking ? (
          <Check className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <div>
          <p className="font-medium">
            {allWorking 
              ? "All clear!" 
              : `Found ${brokenCount} broken link${brokenCount > 1 ? 's' : ''}`}
          </p>
          <p className="text-sm">
            {allWorking 
              ? `All ${totalCount} links on this page are working properly.` 
              : `${brokenCount} out of ${totalCount} links on this page need attention.`}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StatusBanner;
