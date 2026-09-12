import * as React from "react";
import type { Receipt } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import type { BusinessInstance } from "@/types";
import { safeToDate } from "@/lib/utils";

interface ReceiptDetailsProps {
    receipt: Receipt;
    business?: BusinessInstance | null;
    currencySymbol?: string;
    isInvoice?: boolean;
    amountReceived?: number;
    showAdminDetails?: boolean;
}

const Watermark = ({ businessName }: { businessName: string }) => (
    <div className="watermark absolute inset-0 flex items-center justify-center text-gray-200 text-8xl font-bold uppercase select-none -z-10 opacity-30 -rotate-45 pointer-events-none">
        {businessName.split(' ').slice(0, 2).join(' ')}
    </div>
);

const ReceiptDetails = React.memo(React.forwardRef<HTMLDivElement, ReceiptDetailsProps>(
    ({ receipt, business, currencySymbol = '₦', isInvoice = false, amountReceived, showAdminDetails = false }, ref) => {
        const businessName = business?.name || 'Your Business';
        const businessAddress = business?.address || '';

        // If it's an invoice, we use a slightly more structured layout but keep it simple as requested
        if (isInvoice) {
            return (
                <div ref={ref}>
                    <Card className="w-full max-w-2xl mx-auto relative overflow-hidden print-receipt p-6">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className="text-xl font-bold text-primary">{businessName}</h1>
                                <p className="text-muted-foreground whitespace-pre-wrap text-[11px]">{businessAddress}</p>
                                {business?.settings?.phone && <p className="text-[10px]">Tel: {business.settings.phone}</p>}
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-bold uppercase text-primary">Invoice</h2>
                                <p className="font-medium text-sm">#{receipt.receiptNumber || receipt.id.substring(0, 8).toUpperCase()}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {receipt.createdAt ? format(safeToDate(receipt.createdAt), 'PPP') : 'N/A'}
                                </p>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Billed To:</h3>
                                <p className="font-semibold text-sm">{receipt.customer?.name || 'Walk-in Customer'}</p>
                                <p className="text-[11px] text-muted-foreground">{receipt.customer?.email || ''}</p>
                            </div>
                            <div className="text-right">
                                <h3 className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Payment Status:</h3>
                                <p className="font-semibold capitalize text-sm">{receipt.status || (receipt.paymentMethod === 'Invoice' ? 'unpaid' : 'paid')}</p>
                                <p className="text-[11px] text-muted-foreground">Via {receipt.paymentMethod}</p>
                            </div>
                        </div>

                        <table className="w-full mb-8 text-[11px]">
                            <thead className="border-b">
                                <tr className="text-left">
                                    <th className="py-2">Item</th>
                                    <th className="py-2 text-center">Qty</th>
                                    <th className="py-2 text-right">Price</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {receipt.items.map((item, index) => (
                                    <tr key={item.productId + index}>
                                        <td className="py-3 font-medium">
                                            {item.name}
                                            {showAdminDetails && item.priceOverridden && (
                                                <span className="ml-2 text-[9px] text-orange-500 font-normal bg-orange-50 dark:bg-orange-500/10 px-1 py-0.5 rounded no-print">
                                                    Overridden
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-center">{item.quantity}</td>
                                        <td className="py-3 text-right">
                                            {showAdminDetails && item.priceOverridden && item.listPrice && item.listPrice !== item.price && (
                                                <span className="text-muted-foreground line-through mr-1 text-[9px] no-print">
                                                    {currencySymbol}{item.listPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            )}
                                            {currencySymbol}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 text-right">{currencySymbol}{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end mb-8">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-[11px]">
                                    <span>Subtotal</span>
                                    <span>{currencySymbol}{receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span>Tax</span>
                                    <span>{currencySymbol}{receipt.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                {receipt.discount > 0 && (
                                    <div className="flex justify-between text-[11px] text-destructive font-medium">
                                        <span>Discount</span>
                                        <span>-{currencySymbol}{receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Total</span>
                                    <span>{currencySymbol}{receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {(business?.settings?.paymentBankName || business?.settings?.paymentInstructions) && (
                            <div className="mt-8 pt-6 border-t border-dashed">
                                <h3 className="text-[11px] font-bold mb-2">Payment Details</h3>
                                <div className="text-[10px] text-muted-foreground">
                                    {business.settings.paymentBankName && (
                                        <p>{business.settings.paymentBankName} | {business.settings.paymentAccountName} | {business.settings.paymentBankAccountId}</p>
                                    )}
                                    {business.settings.paymentInstructions && (
                                        <p className="mt-2 italic">{business.settings.paymentInstructions}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 text-center text-[9px] text-muted-foreground border-t pt-2">
                            <p>Thank you for your business!</p>
                            <p>Generated by Zeneva POS</p>
                        </div>
                    </Card>
                </div>
            );
        }

        // Default Receipt View (Classic) - Optimized for Thermal Printers
        return (
            <div ref={ref} className="w-full bg-white sm:py-4 print:py-0">
                <Card className="w-full max-w-[300px] mx-auto relative overflow-hidden print-receipt shadow-none border-dashed border-2 border-gray-200 bg-white text-black print:border-none print:shadow-none">
                    <Watermark businessName={businessName} />
                    <CardHeader className="text-center pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">{businessName}</CardTitle>
                        {businessAddress && <CardDescription className="text-[9px]">{businessAddress}</CardDescription>}
                    </CardHeader>
                    <CardContent className="text-[10px] px-4 pb-4">
                        <div className="flex justify-between mb-1">
                            <span className="text-gray-500">Receipt ID:</span>
                            <span className="font-mono">{receipt.receiptNumber || receipt.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between mb-3">
                            <span className="text-gray-500">Date:</span>
                            <span className="font-mono">{receipt.createdAt ? format(safeToDate(receipt.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
                        </div>

                        {receipt.customer && (
                            <>
                                <Separator className="my-2 border-dashed border-gray-300" />
                                <div className="mb-2">
                                    <h3 className="font-semibold text-gray-500 uppercase text-[9px]">Billed To:</h3>
                                    <p className="font-medium text-[11px]">{receipt.customer.name}</p>
                                    <p className="text-gray-500 text-[9px]">{receipt.customer.email}</p>
                                </div>
                            </>
                        )}

                        <Separator className="my-3 border-dashed border-gray-300" />

                        <div className="space-y-2">
                            {receipt.items.map((item, index) => (
                                <div key={item.productId + index} className="flex justify-between items-start mb-1 text-[10px]">
                                    <div className="flex-1 pr-2">
                                        <p className="font-medium leading-tight">
                                            {item.name}
                                            {showAdminDetails && item.priceOverridden && (
                                                <span className="ml-1 text-[8px] text-orange-500 font-normal no-print">
                                                    (Overridden)
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-gray-500 text-[9px] mt-0.5">
                                            {item.quantity} x {showAdminDetails && item.priceOverridden && item.listPrice && item.listPrice !== item.price ? (
                                                <span className="line-through mr-1 no-print">{currencySymbol}{item.listPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            ) : null}
                                            {currencySymbol}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <p className="font-medium pt-0.5">{currencySymbol}{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            ))}
                        </div>

                        <Separator className="my-3 border-dashed border-gray-300" />

                        <div className="space-y-1.5 text-[10px] font-medium text-gray-600">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{currencySymbol}{receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>{currencySymbol}{receipt.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {receipt.discount > 0 && (
                                <div className="flex justify-between">
                                    <span>Discount</span>
                                    <span className="text-red-500 font-bold">-{currencySymbol}{receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>

                        <Separator className="my-3 border-dashed border-gray-300" />

                        <div className="flex justify-between font-bold text-sm pt-1">
                            <span>Total</span>
                            <span>{currencySymbol}{receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        {receipt.paymentMethod === 'Cash' && amountReceived !== undefined && amountReceived > 0 && (
                            <div className="space-y-1 mt-3 pt-3 border-t border-dashed border-gray-300 text-[10px] font-medium text-gray-600">
                                <div className="flex justify-between">
                                    <span>Cash Received</span>
                                    <span>{currencySymbol}{amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Change</span>
                                    <span>{currencySymbol}{Math.max(0, amountReceived - receipt.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        )}

                    </CardContent>
                    <div className="bg-gray-50/50 p-4 pt-2 text-center text-[9px] border-t border-dashed border-gray-200">
                        <p className="font-medium text-gray-600 mb-1">Thank you for your business!</p>
                        <p className="text-gray-500">Method: <span className="font-semibold uppercase">{receipt.paymentMethod}</span></p>
                    </div>
                </Card>
            </div>
        );
    }
));
ReceiptDetails.displayName = "ReceiptDetails";

export default ReceiptDetails;
