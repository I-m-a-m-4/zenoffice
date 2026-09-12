'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppWindow, Smartphone, Save, Link as LinkIcon, Eye, X } from 'lucide-react';

const DEFAULT_DESKTOP_LINK = "https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare";
const DEFAULT_MOBILE_LINK = "https://play.google.com/store/apps/details?id=com.zeneva.app&hl=en-US&ah=8ZdJB3DBf5hWEO6U2hBOws2DuyY";

export default function AdminAppUpdates() {
  const [forceUpdateNative, setForceUpdateNative] = useState(false);
  const [isHardForce, setIsHardForce] = useState(false);
  const [desktopLink, setDesktopLink] = useState('');
  const [mobileLink, setMobileLink] = useState('');
  const [targetUsersStr, setTargetUsersStr] = useState('');
  const [targetCategoriesStr, setTargetCategoriesStr] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    
    const loadSettings = async () => {
      try {
        const docRef = doc(firestore, 'platform_settings', 'app_updates');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setForceUpdateNative(data.forceUpdateNative || false);
          setIsHardForce(data.isHardForce || false);
          setDesktopLink(data.desktopLink || '');
          setMobileLink(data.mobileLink || '');
          setTargetUsersStr((data.targetUsers || []).join(', '));
          setTargetCategoriesStr((data.targetCategories || []).join(', '));
        }
      } catch (err) {
        console.error('Failed to load app update settings:', err);
        toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [firestore, toast]);

  const handleSave = async () => {
    if (!firestore) return;
    
    setIsSaving(true);
    try {
      const targetUsers = targetUsersStr.split(',').map(s => s.trim()).filter(Boolean);
      const targetCategories = targetCategoriesStr.split(',').map(s => s.trim()).filter(Boolean);

      const docRef = doc(firestore, 'platform_settings', 'app_updates');
      await setDoc(docRef, {
        forceUpdateNative,
        isHardForce,
        desktopLink,
        mobileLink,
        targetUsers,
        targetCategories,
        updatedAt: new Date()
      }, { merge: true });
      
      toast({ title: 'Settings saved', description: 'App update settings have been successfully updated.' });
    } catch (err) {
      console.error('Failed to save app update settings:', err);
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">App Updates</h1>
          <p className="text-sm text-slate-500">Manage forced updates for native Zeneva apps.</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Force Update Configuration</CardTitle>
          <CardDescription>
            When enabled, all users on the native desktop and mobile apps will see an "Update required" modal blocking the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50/50">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold text-slate-900">Enable Global Update Prompt</Label>
              <p className="text-sm text-slate-500">Show the update screen to all native app users. By default, they can dismiss it.</p>
            </div>
            <Switch
              checked={forceUpdateNative}
              onCheckedChange={setForceUpdateNative}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50/50">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold text-slate-900">Make Update Mandatory (Hard Force)</Label>
              <p className="text-sm text-slate-500">If enabled, the Close button is removed and users are forced to update immediately.</p>
            </div>
            <Switch
              checked={isHardForce}
              onCheckedChange={setIsHardForce}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Targeted Updates</h3>
            <p className="text-sm text-slate-500 mb-4">If the global toggle above is OFF, you can target specific users or categories.</p>

            <div className="grid gap-2">
              <Label htmlFor="targetUsers">Target users — email or user ID (comma-separated)</Label>
              <Input
                id="targetUsers"
                placeholder="owner@shop.com, another@shop.com"
                value={targetUsersStr}
                onChange={(e) => setTargetUsersStr(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Only these users will see the update prompt. Email is matched
                case-insensitively; a user ID must be exact. This field used to accept
                user IDs only, so an email entered here silently matched nobody.
              </p>
            </div>

            <div className="grid gap-2 mt-4">
              <Label htmlFor="targetCategories">Target Categories (comma-separated)</Label>
              <Input
                id="targetCategories"
                placeholder="Pharmacy, Supermarket, ..."
                value={targetCategoriesStr}
                onChange={(e) => setTargetCategoriesStr(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Matched case-insensitively against the business&apos;s Industry setting.
              </p>
            </div>

            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              The prompt only appears in the <strong>installed desktop and mobile
              apps</strong> — never in a browser, because a web user always has the
              latest version already. Testing this in a browser tab will show nothing
              no matter what is configured here.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <AppWindow className="w-4 h-4" /> Desktop App (Windows)
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="desktopLink">Microsoft Store Link</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-indigo-600 px-2"
                  onClick={() => setDesktopLink(DEFAULT_DESKTOP_LINK)}
                >
                  <LinkIcon className="h-3 w-3 mr-1" /> Use Default
                </Button>
              </div>
              <Input
                id="desktopLink"
                placeholder="ms-windows-store://pdp/?productid=..."
                value={desktopLink}
                onChange={(e) => setDesktopLink(e.target.value)}
              />
              <p className="text-xs text-slate-500">The URL opened when the user clicks "Update" on Windows.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2 mt-6">
              <Smartphone className="w-4 h-4" /> Mobile App (Android/iOS)
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="mobileLink">App Store / Play Store Link</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-indigo-600 px-2"
                  onClick={() => setMobileLink(DEFAULT_MOBILE_LINK)}
                >
                  <LinkIcon className="h-3 w-3 mr-1" /> Use Default
                </Button>
              </div>
              <Input
                id="mobileLink"
                placeholder="https://play.google.com/store/apps/details?id=..."
                value={mobileLink}
                onChange={(e) => setMobileLink(e.target.value)}
              />
              <p className="text-xs text-slate-500">The URL opened when the user clicks "Update" on mobile.</p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? 'Saving...' : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" /> Live Preview
            </CardTitle>
            <CardDescription>This is exactly what users will see on their screen when blocked.</CardDescription>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
            <Button 
              variant={previewTheme === 'light' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-xs px-3 shadow-none"
              onClick={() => setPreviewTheme('light')}
            >
              Light Mode
            </Button>
            <Button 
              variant={previewTheme === 'dark' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 text-xs px-3 shadow-none"
              onClick={() => setPreviewTheme('dark')}
            >
              Dark Mode
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`bg-black/5 dark:bg-white/5 rounded-xl p-8 flex items-center justify-center min-h-[300px] ${previewTheme}`}>
            {/* Replica of the UpdateRequiredModal UI */}
            <div className="w-[425px] relative bg-background border border-border shadow-2xl text-foreground p-6 rounded-xl flex flex-col gap-6">
              {!isHardForce && (
                <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              )}
              <div>
                <h2 className="text-xl font-semibold tracking-tight mb-2">Update required</h2>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {isHardForce 
                    ? "Please update to the latest version of Zeneva. This version has expired and you can no longer use it."
                    : "A new version of Zeneva is available. Please update to get the latest features and improvements."}
                </div>
              </div>
              
              <div className="flex flex-row sm:justify-end gap-3 pt-2">
                {!isHardForce && (
                  <Button 
                    variant="outline" 
                    className="rounded-full bg-transparent border-border text-orange-600 dark:text-orange-500 hover:bg-orange-500/10 transition-colors h-10 px-6"
                  >
                    Close
                  </Button>
                )}
                <Button 
                  className="rounded-full bg-orange-600 hover:bg-orange-700 text-white font-medium h-10 px-6 border-0"
                >
                  Update
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
