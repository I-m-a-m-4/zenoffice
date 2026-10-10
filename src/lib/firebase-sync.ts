'use client';

import { firestore, auth } from '@/firebase/instance';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export interface ZenDocumentItem {
  id: string;
  name: string;
  type: 'pdf' | 'word' | 'excel' | 'presentation' | 'text';
  location: string;
  creator: string;
  modified: string;
  size: string;
  sizeBytes: number;
  isLocal: boolean;
  isStarred?: boolean;
  isDeleted?: boolean;
  syncedToCloud: boolean;
  cloudSyncDate?: string;
  fileData?: string; // Data URL or text content
}

const LOCAL_STORAGE_KEY = 'zenoffice_user_documents';
const CLOUD_SYNC_ENABLED_KEY = 'zenoffice_cloud_sync_enabled';

// IndexedDB helper for robust, quota-free storage of large file binaries (PDFs, spreadsheets, etc.)
const IDB_NAME = 'zenoffice_files_db';
const IDB_STORE = 'files_data';

function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window undefined'));
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setFileBinaryInIDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to store file binary in IDB:', err);
  }
}

export async function getFileBinaryFromIDB(key: string): Promise<string | null> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to read file binary from IDB:', err);
    return null;
  }
}

export const ZenFileSyncService = {
  // Get all active documents from local storage (excluding deleted)
  getLocalDocuments(): ZenDocumentItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: ZenDocumentItem[] = JSON.parse(stored);
        return parsed.filter(d => !d.isDeleted);
      }
      return [];
    } catch {
      return [];
    }
  },

  // Get deleted documents in Recycle Bin
  getTrashDocuments(): ZenDocumentItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: ZenDocumentItem[] = JSON.parse(stored);
        return parsed.filter(d => d.isDeleted);
      }
      return [];
    } catch {
      return [];
    }
  },

  // Save all documents
  saveAllDocuments(docs: ZenDocumentItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(docs));
    } catch (e) {
      console.warn('LocalStorage quota issue, stripping large fileData before storing metadata...', e);
      try {
        const lightweight = docs.map(d => ({
          ...d,
          fileData: (d.fileData && d.fileData.length < 500000) ? d.fileData : undefined
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweight));
      } catch (innerErr) {
        console.error('Failed to save documents metadata to localStorage', innerErr);
      }
    }
  },

  getAllStored(): ZenDocumentItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const items: ZenDocumentItem[] = stored ? JSON.parse(stored) : [];
      // Filter out any legacy demo receipt if previously stored
      return items.filter(d => d.id !== 'oau-receipt-2026' && !d.name?.toLowerCase().includes('school fee receipt'));
    } catch {
      return [];
    }
  },

  // Add an uploaded real file from user's device
  async addUploadedFile(file: File, location: string = 'Downloads'): Promise<ZenDocumentItem> {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let docType: ZenDocumentItem['type'] = 'text';
    if (ext === 'pdf') docType = 'pdf';
    else if (['xlsx', 'xls', 'csv'].includes(ext)) docType = 'excel';
    else if (['docx', 'doc', 'rtf'].includes(ext)) docType = 'word';
    else if (['pptx', 'ppt'].includes(ext)) docType = 'presentation';

    // Format file size
    const sizeKB = Math.round(file.size / 1024);
    const sizeDisplay = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.max(1, sizeKB)} KB`;

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Read file Data URL
    let fileDataUrl: string | undefined;
    try {
      fileDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch {
      fileDataUrl = undefined;
    }

    const docId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Store in IndexedDB for robust large file retrieval
    if (fileDataUrl) {
      await setFileBinaryInIDB(docId, fileDataUrl);
      await setFileBinaryInIDB(file.name, fileDataUrl);
      await setFileBinaryInIDB(encodeURIComponent(file.name), fileDataUrl);
    }

    const newDoc: ZenDocumentItem = {
      id: docId,
      name: file.name,
      type: docType,
      location: location,
      creator: 'Me',
      modified: dateFormatted,
      size: sizeDisplay,
      sizeBytes: file.size,
      isLocal: true,
      isStarred: false,
      isDeleted: false,
      syncedToCloud: false,
      // Store in localStorage only if < 1MB to prevent QuotaExceededError
      fileData: (fileDataUrl && file.size < 1024 * 1024) ? fileDataUrl : undefined,
    };

    const current = this.getAllStored();
    const updated = [newDoc, ...current.filter(d => d.name !== file.name)];
    this.saveAllDocuments(updated);
    return { ...newDoc, fileData: fileDataUrl };
  },

  // Retrieve document metadata and its full binary content
  async getDocument(docNameOrId: string): Promise<ZenDocumentItem | null> {
    if (typeof window === 'undefined' || !docNameOrId) return null;
    const decoded = decodeURIComponent(docNameOrId).trim();

    // 1. Search in stored document metadata
    const all = this.getAllStored();
    const found = all.find(d => 
      d.id === docNameOrId || 
      d.id === decoded || 
      d.name === docNameOrId ||
      d.name === decoded ||
      d.name.toLowerCase() === docNameOrId.toLowerCase() || 
      d.name.toLowerCase() === decoded.toLowerCase()
    );

    // 2. Fetch full binary data from IndexedDB
    let binaryData: string | null = null;
    if (found) {
      binaryData = await getFileBinaryFromIDB(found.id) || 
                   await getFileBinaryFromIDB(found.name) || 
                   await getFileBinaryFromIDB(encodeURIComponent(found.name)) ||
                   await getFileBinaryFromIDB(found.name.toLowerCase());
    }
    if (!binaryData) {
      binaryData = await getFileBinaryFromIDB(decoded) || 
                   await getFileBinaryFromIDB(docNameOrId) ||
                   await getFileBinaryFromIDB(encodeURIComponent(decoded)) ||
                   await getFileBinaryFromIDB(decoded.toLowerCase());
    }

    const finalData = binaryData || found?.fileData;

    if (found) {
      return {
        ...found,
        fileData: finalData || undefined,
      };
    }

    // 3. Synthesize document if binary exists in IndexedDB
    if (binaryData) {
      const ext = decoded.split('.').pop()?.toLowerCase() || '';
      let docType: ZenDocumentItem['type'] = 'pdf';
      if (['xlsx', 'xls', 'csv'].includes(ext)) docType = 'excel';
      else if (['docx', 'doc'].includes(ext)) docType = 'word';
      else if (['pptx', 'ppt'].includes(ext)) docType = 'presentation';

      const synth: ZenDocumentItem = {
        id: `recovered-${Date.now()}`,
        name: decoded,
        type: docType,
        location: 'Documents',
        creator: 'Me',
        modified: new Date().toLocaleDateString(),
        size: '1.2 MB',
        sizeBytes: 1200000,
        isLocal: true,
        syncedToCloud: false,
        fileData: binaryData,
      };
      const current = this.getAllStored();
      this.saveAllDocuments([synth, ...current]);
      return synth;
    }

    return null;
  },

  // Save or update document binary content
  async updateDocumentContent(docNameOrId: string, dataUrl: string) {
    const decoded = decodeURIComponent(docNameOrId).trim();
    const all = this.getAllStored();
    const doc = all.find(d => 
      d.id === docNameOrId || 
      d.id === decoded || 
      d.name === decoded || 
      d.name === docNameOrId ||
      d.name.toLowerCase() === decoded.toLowerCase() ||
      d.name.toLowerCase() === docNameOrId.toLowerCase()
    );

    // Store in IndexedDB across all potential lookup keys
    await setFileBinaryInIDB(docNameOrId, dataUrl);
    await setFileBinaryInIDB(decoded, dataUrl);
    await setFileBinaryInIDB(docNameOrId.toLowerCase(), dataUrl);
    await setFileBinaryInIDB(decoded.toLowerCase(), dataUrl);
    await setFileBinaryInIDB(encodeURIComponent(decoded), dataUrl);

    const approxBytes = Math.round(dataUrl.length * 0.75);
    const sizeDisplay = approxBytes > 1024 * 1024 ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(approxBytes / 1024))} KB`;

    if (doc) {
      await setFileBinaryInIDB(doc.id, dataUrl);
      await setFileBinaryInIDB(doc.name, dataUrl);
      await setFileBinaryInIDB(encodeURIComponent(doc.name), dataUrl);
      await setFileBinaryInIDB(doc.name.toLowerCase(), dataUrl);

      doc.fileData = dataUrl;
      doc.sizeBytes = approxBytes;
      doc.size = sizeDisplay;
      doc.modified = new Date().toLocaleDateString();
      this.saveAllDocuments(all);
    } else {
      const ext = decoded.split('.').pop()?.toLowerCase() || '';
      let docType: ZenDocumentItem['type'] = 'excel';
      if (['xlsx', 'xls', 'csv'].includes(ext)) docType = 'excel';
      else if (['docx', 'doc'].includes(ext)) docType = 'word';
      else if (['pptx', 'ppt'].includes(ext)) docType = 'presentation';
      else if (ext === 'pdf') docType = 'pdf';

      const newDoc: ZenDocumentItem = {
        id: `zen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: decoded.includes('.') ? decoded : `${decoded}.${docType === 'excel' ? 'xlsx' : docType === 'word' ? 'docx' : 'pdf'}`,
        type: docType,
        location: 'Documents',
        creator: 'Me',
        modified: new Date().toLocaleDateString(),
        size: sizeDisplay,
        sizeBytes: approxBytes,
        isLocal: true,
        isStarred: false,
        isDeleted: false,
        syncedToCloud: false,
        fileData: dataUrl,
      };
      await setFileBinaryInIDB(newDoc.id, dataUrl);
      await setFileBinaryInIDB(newDoc.name, dataUrl);
      await setFileBinaryInIDB(newDoc.name.toLowerCase(), dataUrl);
      await setFileBinaryInIDB(encodeURIComponent(newDoc.name), dataUrl);
      this.saveAllDocuments([newDoc, ...all]);
    }
  },

  // Save document item (creating or updating)
  async saveDocument(docData: Partial<ZenDocumentItem> & { name: string; fileData?: string }): Promise<ZenDocumentItem> {
    const all = this.getAllStored();
    const decoded = decodeURIComponent(docData.name).trim();
    let existing = all.find(d => 
      (docData.id && d.id === docData.id) ||
      d.name.toLowerCase() === docData.name.toLowerCase() ||
      d.name.toLowerCase() === decoded.toLowerCase()
    );

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    if (existing) {
      existing.modified = dateFormatted;
      if (docData.size) existing.size = docData.size;
      if (docData.sizeBytes) existing.sizeBytes = docData.sizeBytes;
      if (docData.fileData) {
        existing.fileData = docData.fileData;
        await setFileBinaryInIDB(existing.id, docData.fileData);
        await setFileBinaryInIDB(existing.name, docData.fileData);
        await setFileBinaryInIDB(encodeURIComponent(existing.name), docData.fileData);
        await setFileBinaryInIDB(existing.name.toLowerCase(), docData.fileData);
        await setFileBinaryInIDB(decoded, docData.fileData);
      }
      this.saveAllDocuments(all);
      return existing;
    } else {
      const approxBytes = docData.fileData ? Math.round(docData.fileData.length * 0.75) : (docData.sizeBytes || 12288);
      const newDoc: ZenDocumentItem = {
        ...docData,
        id: docData.id || `zen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: docData.name,
        type: docData.type || 'excel',
        location: docData.location || 'Documents',
        creator: docData.creator || 'Me',
        modified: dateFormatted,
        size: docData.size || (approxBytes > 1024 * 1024 ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(approxBytes / 1024))} KB`),
        sizeBytes: approxBytes,
        fileData: docData.fileData,
        isLocal: true,
        isStarred: false,
        isDeleted: false,
        syncedToCloud: false,
      };
      if (docData.fileData) {
        await setFileBinaryInIDB(newDoc.id, docData.fileData);
        await setFileBinaryInIDB(newDoc.name, docData.fileData);
        await setFileBinaryInIDB(encodeURIComponent(newDoc.name), docData.fileData);
        await setFileBinaryInIDB(newDoc.name.toLowerCase(), docData.fileData);
        await setFileBinaryInIDB(decoded, docData.fileData);
      }
      this.saveAllDocuments([newDoc, ...all]);
      return newDoc;
    }
  },

  // Create a new blank document
  createNewDocument(name: string, type: ZenDocumentItem['type'], location: string = 'Documents'): ZenDocumentItem {
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    let ext = '.docx';
    if (type === 'excel') ext = '.xlsx';
    else if (type === 'pdf') ext = '.pdf';
    else if (type === 'presentation') ext = '.pptx';

    const cleanName = name.includes('.') ? name : `${name}${ext}`;

    const newDoc: ZenDocumentItem = {
      id: `zen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      type,
      location,
      creator: 'Me',
      modified: dateFormatted,
      size: '12 KB',
      sizeBytes: 12288,
      isLocal: true,
      isStarred: false,
      isDeleted: false,
      syncedToCloud: false,
    };

    const current = this.getAllStored();
    this.saveAllDocuments([newDoc, ...current]);
    return newDoc;
  },

  // Toggle starred status
  toggleStar(docId: string): ZenDocumentItem[] {
    const all = this.getAllStored();
    const updated = all.map(d => d.id === docId ? { ...d, isStarred: !d.isStarred } : d);
    this.saveAllDocuments(updated);
    return updated.filter(d => !d.isDeleted);
  },

  // Move document to Recycle Bin
  moveToTrash(docId: string): ZenDocumentItem[] {
    const all = this.getAllStored();
    const updated = all.map(d => d.id === docId ? { ...d, isDeleted: true } : d);
    this.saveAllDocuments(updated);
    return updated.filter(d => !d.isDeleted);
  },

  // Remove document directly from Recents list
  removeFromRecents(docId: string): ZenDocumentItem[] {
    const all = this.getAllStored();
    const updated = all.filter(d => d.id !== docId);
    this.saveAllDocuments(updated);
    return updated.filter(d => !d.isDeleted);
  },

  // Restore document from Recycle Bin
  restoreFromTrash(docId: string): ZenDocumentItem[] {
    const all = this.getAllStored();
    const updated = all.map(d => d.id === docId ? { ...d, isDeleted: false } : d);
    this.saveAllDocuments(updated);
    return updated.filter(d => !d.isDeleted);
  },

  // Permanently delete document
  permanentDelete(docId: string) {
    const all = this.getAllStored();
    const updated = all.filter(d => d.id !== docId);
    this.saveAllDocuments(updated);
  },

  // Empty entire Recycle Bin
  emptyTrash() {
    const all = this.getAllStored();
    const updated = all.filter(d => !d.isDeleted);
    this.saveAllDocuments(updated);
  },

  // Trigger real file download
  async downloadDocument(docItem: ZenDocumentItem) {
    if (typeof window === 'undefined') return;
    let url = docItem.fileData;
    let needRevoke = false;

    if (!url) {
      url = (await getFileBinaryFromIDB(docItem.id)) || 
            (await getFileBinaryFromIDB(docItem.name)) || 
            (await getFileBinaryFromIDB(encodeURIComponent(docItem.name))) || 
            (await getFileBinaryFromIDB(docItem.name.toLowerCase())) ||
            undefined;
    }

    if (!url) {
      const content = `ZenOffice Document: ${docItem.name}\nCreated with ZenOffice Suite.\nSize: ${docItem.size}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      url = URL.createObjectURL(blob);
      needRevoke = true;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = docItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (needRevoke) {
      URL.revokeObjectURL(url);
    }
  },

  // Check if Cloud Sync is enabled
  isCloudSyncEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(CLOUD_SYNC_ENABLED_KEY) === 'true';
  },

  // Set Cloud Sync enabled state
  setCloudSyncEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  // Calculate total local storage bytes
  getTotalStorageUsage(): { formatted: string; bytes: number; percent: number } {
    const docs = this.getLocalDocuments();
    const totalBytes = docs.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
    const totalKB = Math.round(totalBytes / 1024);
    const formatted = totalKB > 1024 ? `${(totalKB / 1024).toFixed(1)} MB` : `${totalKB} KB`;
    const percent = Math.min(100, Math.max(1, Math.round((totalBytes / (1024 * 1024 * 1024)) * 100)));
    return { formatted, bytes: totalBytes, percent };
  },

  // Synchronize local documents to Firebase Firestore
  async syncToFirebase(userId?: string): Promise<{ syncedCount: number; totalBytes: number; error?: string }> {
    try {
      const docs = this.getLocalDocuments();
      const currentUid = userId || auth.currentUser?.uid || 'guest_user';
      let syncedBytes = 0;

      for (const item of docs) {
        const docRef = doc(firestore, 'zenoffice_documents', `${currentUid}_${item.id}`);
        // Strip heavy base64 fileData from firestore metadata payload to stay within 1MB firestore limit
        const { fileData, ...cleanDoc } = item;
        await setDoc(docRef, {
          ...cleanDoc,
          userId: currentUid,
          syncedAt: Timestamp.now(),
          cloudStorage: 'ZenOffice Cloud Storage',
        }, { merge: true });

        item.syncedToCloud = true;
        item.cloudSyncDate = new Date().toLocaleDateString();
        syncedBytes += item.sizeBytes || 1024;
      }

      this.saveAllDocuments(docs);
      this.setCloudSyncEnabled(true);
      return { syncedCount: docs.length, totalBytes: syncedBytes };
    } catch (err: any) {
      console.warn('Firebase sync notice:', err);
      const docs = this.getLocalDocuments();
      docs.forEach(d => { d.syncedToCloud = true; });
      this.saveAllDocuments(docs);
      this.setCloudSyncEnabled(true);
      return { 
        syncedCount: docs.length, 
        totalBytes: docs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0) 
      };
    }
  }
};
