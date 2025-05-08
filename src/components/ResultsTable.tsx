
import React, { useState } from "react";
import { LinkCheckResult } from "@/types/linkTypes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";

interface ResultsTableProps {
  results: LinkCheckResult[];
}

type SortField = "url" | "status";
type SortOrder = "asc" | "desc";

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === "url") {
      return sortOrder === "asc" 
        ? a.url.localeCompare(b.url)
        : b.url.localeCompare(a.url);
    } else {
      // Sort by status (working links first if asc, broken links first if desc)
      if (a.isWorking === b.isWorking) return 0;
      if (sortOrder === "asc") {
        return a.isWorking ? -1 : 1;
      } else {
        return a.isWorking ? 1 : -1;
      }
    }
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
  };

  const renderStatusBadge = (result: LinkCheckResult) => {
    if (result.isWorking) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <Check className="h-3 w-3" />
          OK
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
        <X className="h-3 w-3" />
        Broken
      </Badge>
    );
  };

  return (
    <div className="rounded-md border overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60%]">
              <Button 
                variant="ghost" 
                onClick={() => handleSort("url")}
                className="font-semibold p-0 h-auto flex items-center"
              >
                Link URL {getSortIcon("url")}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                onClick={() => handleSort("status")}
                className="font-semibold p-0 h-auto flex items-center"
              >
                Status {getSortIcon("status")}
              </Button>
            </TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults.map((result, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium overflow-hidden text-ellipsis">
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline"
                >
                  {result.url}
                </a>
              </TableCell>
              <TableCell>{renderStatusBadge(result)}</TableCell>
              <TableCell>
                {result.isWorking ? (
                  <span className="text-gray-500">{result.statusCode || "200 OK"}</span>
                ) : (
                  <span className="text-red-600">
                    {result.statusCode || ""} {result.error || "Connection failed"}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ResultsTable;
