
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import type { Receipt } from '@/types';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import Link from 'next/link';

interface RecentSalesTableProps {
  receipts: Receipt[];
  currencySymbol: string;
}

export default function RecentSalesTable({ receipts, currencySymbol }: RecentSalesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>A list of sales within the selected date range.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length > 0 ? (
                receipts.slice(0, 20).map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <div className="font-medium">{receipt.customer?.name || 'Walk-in Customer'}</div>
                    </TableCell>
                    <TableCell>{format(receipt.createdAt.toDate(), 'PP')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Paid
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{currencySymbol}{receipt.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No sales in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
