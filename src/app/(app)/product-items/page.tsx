import {
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Wrench } from "lucide-react";

export default function ProductItemsPage() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
          <Link href="/inventory">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0 font-headline">
          Product Variants
        </h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Under Construction</CardTitle>
            <CardDescription>This feature for managing product variants is coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center text-center p-12">
            <Wrench className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Coming Soon!</p>
            <p className="text-muted-foreground">We're working hard to bring you advanced variant management.</p>
        </CardContent>
      </Card>
    </div>
  );
}
