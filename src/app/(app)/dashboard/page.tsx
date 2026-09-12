'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  FileText, FileSpreadsheet, FileIcon, 
  MoreHorizontal, FilePlus, Sparkles,
  Search, Grid, List, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const RECENT_FILES = [
  { id: '1', name: 'Q4 Financial Report.xlsx', type: 'excel', location: 'ZenDrive', creator: 'Me', modified: '2 hours ago', size: '1.2 MB' },
  { id: '2', name: 'Project Proposal.docx', type: 'word', location: 'Documents', creator: 'John Doe', modified: 'Yesterday', size: '245 KB' },
  { id: '3', name: 'Employee Handbook.pdf', type: 'pdf', location: 'Shared', creator: 'HR Dept', modified: 'Oct 12', size: '3.4 MB' },
  { id: '4', name: 'Meeting Notes.docx', type: 'word', location: 'ZenDrive', creator: 'Me', modified: 'Oct 10', size: '12 KB' },
  { id: '5', name: 'Budget 2024.xlsx', type: 'excel', location: 'ZenDrive', creator: 'Me', modified: 'Oct 05', size: '890 KB' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full max-w-[1600px] mx-auto">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col gap-8">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-sm flex items-center justify-between overflow-hidden relative">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
             <Sparkles className="w-64 h-64 -mt-16 -mr-16" />
          </div>
          <div className="relative z-10 max-w-lg">
            <h1 className="text-3xl font-bold mb-2">Welcome to ZenOffice!</h1>
            <p className="text-blue-100 mb-6 text-lg">Create, edit, and collaborate on your documents from anywhere.</p>
            <div className="flex gap-3">
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 border-0 shadow-sm">
                <Link href="/editor/document">
                  <FileText className="mr-2 h-4 w-4" /> Word
                </Link>
              </Button>
              <Button asChild className="bg-white/20 text-white hover:bg-white/30 border-0">
                <Link href="/editor/excel">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </Link>
              </Button>
              <Button asChild className="bg-white/20 text-white hover:bg-white/30 border-0">
                <Link href="/editor/pdf">
                  <FileIcon className="mr-2 h-4 w-4" /> PDF
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Files Table */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" /> Recent Files
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:bg-slate-100">
                <Grid className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-500 bg-slate-100">
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[400px]">Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_FILES.map((file) => (
                  <TableRow key={file.id} className="group hover:bg-slate-50 cursor-pointer">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {file.type === 'word' && <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><FileText className="w-4 h-4" /></div>}
                        {file.type === 'excel' && <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><FileSpreadsheet className="w-4 h-4" /></div>}
                        {file.type === 'pdf' && <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><FileIcon className="w-4 h-4" /></div>}
                        <Link href={`/editor/${file.type === 'word' ? 'document' : file.type === 'excel' ? 'excel' : 'pdf'}?id=${file.id}`} className="hover:underline hover:text-blue-600 truncate max-w-[300px]">
                          {file.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{file.location}</TableCell>
                    <TableCell className="text-slate-500">{file.creator}</TableCell>
                    <TableCell className="text-slate-500">{file.modified}</TableCell>
                    <TableCell className="text-slate-500">{file.size}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Open</DropdownMenuItem>
                          <DropdownMenuItem>Share</DropdownMenuItem>
                          <DropdownMenuItem>Rename</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {RECENT_FILES.length === 0 && (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <FilePlus className="w-12 h-12 mb-3 text-slate-300" />
                <p>No recent files found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
        
        {/* Templates / Recommendations */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
             Featured Templates
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] bg-slate-100 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col p-2">
               <div className="flex-1 bg-white rounded flex items-center justify-center p-2">
                 <div className="w-full h-2 bg-slate-200 rounded-full mb-1" />
                 <div className="w-3/4 h-2 bg-slate-200 rounded-full" />
               </div>
               <span className="text-xs font-medium text-center mt-2 text-slate-700">Resume</span>
            </div>
            <div className="aspect-[3/4] bg-slate-100 rounded-lg border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex flex-col p-2">
               <div className="flex-1 bg-white rounded flex items-center justify-center p-2 flex-col gap-1">
                 <div className="w-full h-full border border-slate-200 grid grid-cols-3 grid-rows-4 gap-px bg-slate-200">
                    {Array.from({length: 12}).map((_, i) => <div key={i} className="bg-white" />)}
                 </div>
               </div>
               <span className="text-xs font-medium text-center mt-2 text-slate-700">Invoice</span>
            </div>
          </div>
          <Button variant="link" className="w-full mt-2 text-blue-600 h-auto p-0 justify-center text-sm font-medium">View all templates</Button>
        </div>

        {/* Recommended Features */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
             Recommended Features
          </h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">PDF to Word</p>
                <p className="text-xs text-slate-500">Convert PDFs easily</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">AI Proofreader</p>
                <p className="text-xs text-slate-500">Check grammar & style</p>
              </div>
            </button>
             <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Image to Text</p>
                <p className="text-xs text-slate-500">Extract text via OCR</p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
