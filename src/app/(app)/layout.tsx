'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Home, FolderOpen, Clock, Star, Share2, 
  Cloud, HardDrive, Download, Search, 
  Plus, Settings, HelpCircle, FileText
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      router.push('/auth/login-session');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ThemeProvider forcedTheme="light">
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden w-full bg-slate-50">
          <Sidebar variant="sidebar" className="border-r border-slate-200 bg-slate-50 w-64">
            <SidebarHeader className="p-4 flex flex-row items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md font-bold text-xl">
                  Z
                </div>
                <span className="text-xl font-bold text-slate-800 tracking-tight">ZenOffice</span>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-2 py-4">
              <div className="mb-6 px-2">
                <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-11" asChild>
                  <Link href="/dashboard">
                    <Plus className="mr-2 h-5 w-5" />
                    New Document
                  </Link>
                </Button>
              </div>

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[
                      { href: '/dashboard', icon: Home, label: 'Home' },
                      { href: '/open', icon: FolderOpen, label: 'Open' },
                      { href: '/recent', icon: Clock, label: 'Recent' },
                      { href: '/starred', icon: Star, label: 'Starred' },
                      { href: '/shared', icon: Share2, label: 'Shared' },
                    ].map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton 
                          asChild
                          isActive={pathname === item.href}
                          className="font-medium h-10 data-[active=true]:bg-blue-100 data-[active=true]:text-blue-700 data-[active=true]:hover:bg-blue-100"
                        >
                          <Link href={item.href}>
                            <item.icon className="h-5 w-5 mr-2" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="my-4 mx-4 w-auto bg-slate-200" />

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Cloud Storage</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[
                      { href: '#', icon: Cloud, label: 'ZenDrive' },
                      { href: '#', icon: Cloud, label: 'Google Drive' },
                      { href: '#', icon: Cloud, label: 'Dropbox' },
                    ].map((item, idx) => (
                      <SidebarMenuItem key={idx}>
                        <SidebarMenuButton asChild className="h-9 text-slate-600 hover:text-slate-900">
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4 mr-2 opacity-70" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="my-4 mx-4 w-auto bg-slate-200" />

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Local Storage</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[
                      { href: '#', icon: HardDrive, label: 'Desktop' },
                      { href: '#', icon: FileText, label: 'Documents' },
                      { href: '#', icon: Download, label: 'Downloads' },
                    ].map((item, idx) => (
                      <SidebarMenuItem key={idx}>
                        <SidebarMenuButton asChild className="h-9 text-slate-600 hover:text-slate-900">
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4 mr-2 opacity-70" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-slate-200">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-slate-100 text-slate-600">ME</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-slate-900 truncate">My Account</span>
                  <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-blue-600 text-left truncate">Sign out</button>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col min-w-0 bg-white">
            <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger className="text-slate-500 md:hidden" />
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search documents..." 
                    className="w-full h-10 pl-9 pr-4 rounded-full bg-slate-100 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full">
                  <HelpCircle className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full">
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </header>
            
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-6 h-full">
                {children}
              </div>
            </ScrollArea>
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
