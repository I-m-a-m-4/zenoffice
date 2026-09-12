'use client';

import Link from "next/link";
import { Twitter, Instagram, Facebook, Phone, Mail, Clock, MapPin } from "lucide-react";
import type { BusinessInstance } from "@/types";
import { AppConfig } from "@/lib/config";

export default function StoreFooter({ business }: { business: BusinessInstance | null }) {
    if (!business) return null;

    const { name: businessName, settings } = business;
    const {
        publicStore,
        productCategories,
    } = settings || {};

    const {
        socialTwitter,
        socialInstagram,
        socialFacebook,
        socialWhatsapp,
        description,
        footerText,
        officeLocations,
        contactPhone,
        contactEmail,
        businessHours,
        googleMapsLink
    } = publicStore || {};
    
    return (
        <footer className="bg-gradient-to-t from-muted/50 to-background text-foreground border-t">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
                    {/* Column 1: Business Info */}
                    <div className="lg:col-span-2 space-y-4">
                         <div className="flex items-center gap-2">
                             <img src={business.settings?.logoUrl || AppConfig.logoIconUrl} alt={`${businessName} Logo`} className="h-8 w-8" />
                            <h3 className="font-instrument-serif text-2xl font-semibold tracking-tight">{businessName}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{description || 'Your one-stop shop for quality products.'}</p>
                        <div className="flex items-center gap-3 pt-2">
                            {socialTwitter && <a href={`https://twitter.com/${socialTwitter}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 flex items-center justify-center rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Twitter"><Twitter className="h-5 w-5"/></a>}
                            {socialInstagram && <a href={`https://instagram.com/${socialInstagram}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 flex items-center justify-center rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Instagram"><Instagram className="h-5 w-5"/></a>}
                            {socialFacebook && <a href={`https://facebook.com/${socialFacebook}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 flex items-center justify-center rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Facebook"><Facebook className="h-5 w-5"/></a>}
                            {socialWhatsapp && <a href={`https://wa.me/${socialWhatsapp}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 flex items-center justify-center rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="WhatsApp"><Phone className="h-5 w-5"/></a>}
                        </div>
                    </div>

                    {/* Column 2: Categories */}
                    <div className="space-y-4">
                        <h3 className="font-instrument-serif text-lg font-semibold tracking-wide uppercase border-b pb-2">Categories</h3>
                        <ul className="space-y-2 pt-2">
                            {(productCategories || []).slice(0, 5).map(cat => (
                                <li key={cat}>
                                    <Link href={`/store/${business.id}?category=${encodeURIComponent(cat)}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                        {cat}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Contact */}
                    <div className="space-y-4">
                        <h3 className="font-instrument-serif text-lg font-semibold tracking-wide uppercase border-b pb-2">Contact Us</h3>
                        <div className="space-y-3 text-sm text-muted-foreground pt-2">
                            {officeLocations && <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-1"/><div className="whitespace-pre-wrap">{officeLocations}</div></div>}
                            {contactPhone && <p className="flex items-start gap-3"><Phone className="h-4 w-4 text-primary flex-shrink-0 mt-1"/> <span>{contactPhone}</span></p>}
                            {contactEmail && <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary flex-shrink-0"/> {contactEmail}</p>}
                            {businessHours && <p className="flex items-center gap-3"><Clock className="h-4 w-4 text-primary flex-shrink-0"/> {businessHours}</p>}
                            {googleMapsLink && <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary font-semibold hover:underline"><MapPin className="h-4 w-4"/> View on Google Maps</a>}
                        </div>
                    </div>
                </div>
                <div className="mt-16 pt-8 border-t border-border/50 text-center text-xs text-muted-foreground">
                     <p>{footerText || `© ${new Date().getFullYear()} ${businessName}. All rights reserved. Powered by Zeneva.`}</p>
                </div>
            </div>
        </footer>
    );
}
