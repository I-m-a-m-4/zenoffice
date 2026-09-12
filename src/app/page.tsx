import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, FileIcon, Cloud, Upload } from 'lucide-react';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
    title: 'ZenOffice | Your Complete Document Suite',
    description: 'Manage, edit, and organize all your documents seamlessly with ZenOffice.',
    alternates: {
        canonical: '/'
    }
};

export default function Home() {
    return (
        <ThemeProvider forcedTheme="light">
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
                {/* Header */}
                <header className="px-6 lg:px-12 py-4 flex items-center justify-between bg-white border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md font-bold text-xl">
                            Z
                        </div>
                        <span className="text-xl font-bold text-slate-800 tracking-tight">ZenOffice</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/auth/login-session" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Log In</Link>
                        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Link href="/signup">Get Started</Link>
                        </Button>
                    </div>
                </header>

                {/* Hero Section */}
                <main className="flex-grow flex flex-col items-center justify-center px-6 py-24 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-8">
                        <Cloud className="w-4 h-4" />
                        <span>Your documents, anywhere.</span>
                    </div>
                    
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight max-w-4xl mb-6 leading-tight">
                        The ultimate workspace for all your files.
                    </h1>
                    
                    <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
                        Create, edit, and collaborate on Word documents, Excel spreadsheets, and PDFs all from one powerful dashboard.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-lg w-full sm:w-auto">
                            <Link href="/signup">Start for free</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="h-12 px-8 text-lg w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100">
                            <Link href="/dashboard">Go to Dashboard</Link>
                        </Button>
                    </div>

                    {/* Feature Highlights */}
                    <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto w-full">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                <FileText className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Docs</h3>
                            <p className="text-slate-600">Rich text editing for all your letters, reports, and memos.</p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                                <FileSpreadsheet className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Sheets</h3>
                            <p className="text-slate-600">Powerful spreadsheets with formulas and charting.</p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-6">
                                <FileIcon className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">PDF</h3>
                            <p className="text-slate-600">View, edit, and annotate PDF documents easily.</p>
                        </div>
                    </div>
                </main>
                
                {/* Footer */}
                <footer className="py-8 text-center text-slate-500 text-sm bg-white border-t border-slate-200">
                    &copy; {new Date().getFullYear()} ZenOffice. All rights reserved.
                </footer>
            </div>
        </ThemeProvider>
    );
}
