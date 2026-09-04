'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useError } from '@/utils/context/ErrorContext';
import { useTranslation } from '@/utils/context/LanguageContext';
import { exportUserData, decryptExportedData, type ExportedData, type DecryptedExportData } from '@/app/settings/api';
import { encryptData, generateIV, generateSalt, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import { Download, Lock, Unlock, Copy, FileText } from 'lucide-react';

interface ExportSectionProps {
  encryptionKey: string;
}

export function ExportSection({ encryptionKey }: ExportSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [usePasswordProtection, setUsePasswordProtection] = useState(false);
  const [exportFormat, setExportFormat] = useState<'encrypted' | 'decrypted'>('encrypted');
  const [exportedData, setExportedData] = useState<ExportedData | null>(null);
  const [decryptedExportedData, setDecryptedExportedData] = useState<DecryptedExportData | null>(null);
  const [encryptedExport, setEncryptedExport] = useState<string>('');
  const { setError } = useError();
  const { t } = useTranslation();

  const handleExport = async () => {
    if (usePasswordProtection && !password.trim()) {
      setError(t('settings.pleaseEnterPassword'));
      return;
    }

    setIsExporting(true);
    try {
      const rawData = await exportUserData();
      let dataToExport: ExportedData | DecryptedExportData;
      let filename: string;
      let formatLabel: string;

      // Determine what data to export based on format
      if (exportFormat === 'decrypted') {
        const decryptedData = decryptExportedData(rawData, encryptionKey);
        dataToExport = decryptedData;
        setDecryptedExportedData(decryptedData);
        setExportedData(null);
        filename = 'streamline-scheduler-decrypted-export';
        formatLabel = 'decrypted';
      } else {
        dataToExport = rawData;
        setExportedData(rawData);
        setDecryptedExportedData(null);
        filename = 'streamline-scheduler-export';
        formatLabel = 'encrypted';
      }

      // Handle password protection
      if (usePasswordProtection) {
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(password, salt);
        const encrypted = encryptData(dataToExport, derivedKey, iv);
        
        const encryptedPackage = {
          encrypted_data: encrypted,
          salt,
          iv,
          version: '1.0.0',
          created_at: new Date().toISOString(),
          original_format: exportFormat // Track the original format
        };
        
        setEncryptedExport(JSON.stringify(encryptedPackage, null, 2));
        
        // Create and download encrypted file
        const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-password-protected-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setEncryptedExport('');
        
        // Create and download plain file
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError(t('settings.failedToExportData', { format: exportFormat }));
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getDataSummary = (data: ExportedData | DecryptedExportData) => {
    if ('tasks' in data.data) {
      // DecryptedExportData
      return t('settings.tasksSummary', {
        tasks: data.data.tasks.length,
        projects: data.data.projects.length,
        calendars: data.data.calendars.length,
        events: data.data.calendarEvents.length
      });
    } else {
      // ExportedData
      return t('settings.tasksSummary', {
        tasks: data.data.can_do_list.length,
        projects: data.data.projects.length,
        calendars: data.data.calendars.length,
        events: data.data.calendar_events.length
      });
    }
  };

  const getFormatDescription = () => {
    if (exportFormat === 'decrypted') {
      return t('settings.decryptedFormatDesc');
    } else {
      return t('settings.encryptedFormatDesc');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('settings.exportYourData')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.exportDesc')}
        </p>
      </div>

      {/* Export Configuration */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium">{t('settings.exportConfiguration')}</h3>
        
        {/* Format Selection */}
        <div className="space-y-3">
          <Label>{t('settings.dataFormat')}</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-encrypted"
                name="format"
                value="encrypted"
                checked={exportFormat === 'encrypted'}
                onChange={(e) => setExportFormat(e.target.value as 'encrypted' | 'decrypted')}
                className="h-4 w-4"
              />
              <Label htmlFor="format-encrypted" className="flex items-center gap-2 cursor-pointer">
                <Unlock className="h-4 w-4" />
                {t('settings.encryptedFormat')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-decrypted"
                name="format"
                value="decrypted"
                checked={exportFormat === 'decrypted'}
                onChange={(e) => setExportFormat(e.target.value as 'encrypted' | 'decrypted')}
                className="h-4 w-4"
              />
              <Label htmlFor="format-decrypted" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                {t('settings.decryptedFormat')}
              </Label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {getFormatDescription()}
          </p>
        </div>

        {/* Password Protection Option */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use-password"
              checked={usePasswordProtection}
              onCheckedChange={(checked) => setUsePasswordProtection(checked as boolean)}
            />
            <Label htmlFor="use-password" className="flex items-center gap-2 cursor-pointer">
              <Lock className="h-4 w-4" />
              {t('settings.addPasswordProtection')}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.passwordProtectionDesc')}
          </p>
          
          {usePasswordProtection && (
            <div className="space-y-2">
              <Label htmlFor="export-password">{t('settings.exportPassword')}</Label>
              <Input
                id="export-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('settings.enterStrongPassword')}
              />
            </div>
          )}
        </div>

        {/* Export Button */}
        <Button 
          onClick={handleExport} 
          disabled={isExporting || (usePasswordProtection && !password.trim())}
          className="w-full"
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? t('settings.exporting') : `${exportFormat === 'decrypted' ? t('settings.exportDecryptedData') : t('settings.exportEncryptedData')}${usePasswordProtection ? ` ${t('settings.exportPasswordProtected')}` : ''}`}
        </Button>
      </div>

      {/* Export Summary */}
      {(exportedData || decryptedExportedData) && (
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-medium">{t('settings.exportSummary')}</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>{t('settings.exportDate')}</span>
              <span>{new Date((decryptedExportedData || exportedData)!.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('settings.dataSummary')}</span>
              <span>{getDataSummary(decryptedExportedData || exportedData!)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('settings.version')}</span>
              <span>{(decryptedExportedData || exportedData)!.version}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('settings.format')}</span>
              <span className="flex items-center gap-1">
                {encryptedExport ? (
                  <>
                    <Lock className="h-3 w-3" />
                    {t('settings.passwordProtected')} ({decryptedExportedData ? t('settings.decrypted') : t('settings.encrypted')})
                  </>
                ) : decryptedExportedData ? (
                  <>
                    <FileText className="h-3 w-3" />
                    {t('settings.decrypted')}
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    {t('settings.encrypted')}
                  </>
                )}
              </span>
            </div>
          </div>
          
          {encryptedExport && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('settings.passwordProtectedExportPreview')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(encryptedExport)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('settings.copy')}
                </Button>
              </div>
              <Textarea
                value={encryptedExport}
                readOnly
                className="h-32 text-xs font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 