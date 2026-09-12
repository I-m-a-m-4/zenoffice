
"use client";

import type { Product, AISuggestions } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePOS } from "@/context/pos-context";
import {
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Loader2,
  PartyPopper,
  Package,
  FileText,
  DollarSign,
  Barcode,
  Edit,
  Flame,
  ShieldAlert,
  Info,
  ImageIcon,
} from "lucide-react";
import React, { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useFirestore } from "@/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import FeatureGate from "@/components/shared/feature-gate";

function IssueDetailsDialog({
  isOpen,
  onOpenChange,
  issue,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  issue: { title: string; items: Product[] } | null;
}) {
  if (!issue) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{issue.title}</DialogTitle>
          <DialogDescription>
            Found {issue.items.length} products with this issue. Click on a
            product to go to its edit page and resolve the issue.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
          <div className="space-y-2 pr-4">
            {issue.items.map((product) => (
              <Link
                href={`/inventory/details?id=${product.id}`}
                key={product.id}
                className="block p-3 rounded-md border hover:bg-muted"
                onClick={() => onOpenChange(false)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.sku || "No SKU"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <div className="flex items-center">
                      <Edit className="h-4 w-4 mr-2" /> Fix
                    </div>
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function IssueCard({
  icon: Icon,
  title,
  description,
  count,
  items,
  unit = "items",
  onFixClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  count: number;
  items: Product[];
  unit?: string;
  onFixClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5 text-destructive" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-3xl font-bold text-destructive">{count}</p>
        <p className="text-xs text-muted-foreground">{unit} with this issue</p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" className="w-full" onClick={onFixClick}>
          <Edit className="h-4 w-4 mr-2" />
          View & Fix All
        </Button>
      </CardFooter>
    </Card>
  );
}


export default function ProductDataQualityTab() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<{
    title: string;
    items: Product[];
  } | null>(null);

  const { products, isLoading } = usePOS();
  
  const analysis = useMemo(() => {
    if (!products) return null;
    const productsWithoutPrice = products.filter((p) => !p.price || p.price <= 0);
    const productsWithoutImage = products.filter((p) => !p.imageUrl);
    const productsWithoutSku = products.filter((p) => !p.sku);
    const productsWithoutCategory = products.filter((p) => !p.category);
    const productsWithoutDescription = products.filter(
      (p) => !p.description || p.description.length < 20
    );

    const totalPoints = products.length * 5;
    const issuePoints =
      productsWithoutPrice.length +
      productsWithoutImage.length +
      productsWithoutSku.length +
      productsWithoutCategory.length +
      productsWithoutDescription.length;
      
    const dataQualityScore =
      totalPoints > 0
        ? Math.round(((totalPoints - issuePoints) / totalPoints) * 100)
        : 100;

    return {
      productsWithoutPrice,
      productsWithoutImage,
      productsWithoutSku,
      productsWithoutCategory,
      productsWithoutDescription,
      dataQualityScore,
      totalProducts: products.length,
    };
  }, [products]);

  const handleFixClick = (title: string, items: Product[]) => {
    setSelectedIssue({ title, items });
    setIsModalOpen(true);
  };

  if (isLoading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Inventory Health Check</CardTitle>
                  <CardDescription>Analyzing your product data...</CardDescription>
              </CardHeader>
              <CardContent>
                   <div className="flex items-center justify-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
              </CardContent>
          </Card>
      );
  }

  if (!analysis || analysis.totalProducts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Health Check</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <h3 className="text-xl font-semibold mt-4">No Products to Analyze</h3>
          <p className="text-muted-foreground mt-2">
            Add some products to your inventory to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allIssues = [
    {
      icon: DollarSign,
      title: "Missing Price",
      description: "Products without a price can't be sold and hurt your store's professionalism.",
      count: analysis.productsWithoutPrice.length,
      items: analysis.productsWithoutPrice,
    },
    {
      icon: ImageIcon,
      title: "Missing Image",
      description: "Images are crucial for online sales and make your POS easier to use.",
      count: analysis.productsWithoutImage.length,
      items: analysis.productsWithoutImage,
    },
    {
      icon: FileText,
      title: "Weak Description",
      description: "Good descriptions improve SEO and help customers make buying decisions.",
      count: analysis.productsWithoutDescription.length,
      items: analysis.productsWithoutDescription,
    },
    {
      icon: Barcode,
      title: "Missing SKU",
      description: "SKUs are essential for accurate tracking and preventing inventory errors.",
      count: analysis.productsWithoutSku.length,
      items: analysis.productsWithoutSku,
    },
    {
      icon: Package,
      title: "Missing Category",
      description: "Categories help organize your store and provide better sales analytics.",
      count: analysis.productsWithoutCategory.length,
      items: analysis.productsWithoutCategory,
    },
  ];

  const hasIssues = allIssues.some((issue) => issue.count > 0);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Data Health</CardTitle>
          <CardDescription>
            Automated analysis of your {analysis.totalProducts} products to identify
            potential data quality issues that could affect sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Overall Data Quality</span>
              <span className="text-sm font-bold">
                {analysis.dataQualityScore}%
              </span>
            </div>
            <Progress
              value={analysis.dataQualityScore}
              aria-label={`${analysis.dataQualityScore}% data quality`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              A score based on data completeness for price, images, SKU, description and category.
            </p>
          </div>

          {hasIssues ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allIssues.map((issue) => (
                <IssueCard
                  key={issue.title}
                  {...issue}
                  onFixClick={() => handleFixClick(issue.title, issue.items)}
                />
              ))}
            </div>
          ) : (
            <Alert
              variant="default"
              className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300 [&>svg]:text-green-600"
            >
              <CheckCircle className="h-4 w-4" />
              <AlertTitle className="font-semibold">
                Excellent Data Quality!
              </AlertTitle>
              <AlertDescription>
                All your products have prices, images, descriptions, categories, and SKUs. Great job!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <IssueDetailsDialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        issue={selectedIssue}
      />
    </div>
  );
}
